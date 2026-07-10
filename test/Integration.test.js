const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration: Factory -> ProjectSale -> Vesting", function () {
  let factory, vesting, paymentToken, projectToken;
  let admin, treasury, investor1, investor2;

  const SOFT_CAP = ethers.parseUnits("1000", 18);
  const HARD_CAP = ethers.parseUnits("5000", 18);

  const TGE_PERCENT = 10;
  const CLIFF = 30 * 24 * 3600;
  const DURATION = 180 * 24 * 3600;
  const INTERVAL = 30 * 24 * 3600;

  let startTime, endTime, saleAddress, sale;

  beforeEach(async () => {
    [admin, treasury, investor1, investor2] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    paymentToken = await ERC20Mock.deploy("USD Coin", "USDC", ethers.parseUnits("1000000", 18));
    projectToken = await ERC20Mock.deploy("Project Token", "PRJ", ethers.parseUnits("1000000", 18));

    for (const u of [investor1, investor2]) {
      await paymentToken.transfer(u.address, ethers.parseUnits("5000", 18));
    }

    // Deploy vesting contract (TGE starts right after sale ends conceptually)
    const vestingStart = (await time.latest()) + 30 * 24 * 3600; // arbitrary future TGE
    const Vesting = await ethers.getContractFactory("VestingContract");
    vesting = await Vesting.deploy(
      await projectToken.getAddress(),
      admin.address,
      TGE_PERCENT,
      CLIFF,
      DURATION,
      INTERVAL,
      vestingStart
    );
    await projectToken.transfer(await vesting.getAddress(), ethers.parseUnits("100000", 18));

    // Deploy factory
    const Factory = await ethers.getContractFactory("SpringboardFactory");
    factory = await Factory.deploy(admin.address);

    // Create sale via factory, linking to the vesting contract
    startTime = (await time.latest()) + 3600;
    endTime = startTime + 7 * 24 * 3600;

    const params = {
      projectId: 1,
      tokenAddress: await projectToken.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      treasury: treasury.address,
      startTime,
      endTime,
      softCap: SOFT_CAP,
      hardCap: HARD_CAP,
      minContribution: ethers.parseUnits("10", 18),
      maxContribution: ethers.parseUnits("2000", 18),
      tokenPrice: ethers.parseUnits("0.5", 18),
      totalAllocation: ethers.parseUnits("10000", 18),
      vestingContract: await vesting.getAddress(),
      refundEnabled: true,
      whitelistRequired: false,
    };

    await factory.connect(admin).createSale(params);
    saleAddress = await factory.getSale(1);
    sale = await ethers.getContractAt("ProjectSale", saleAddress);

    for (const u of [investor1, investor2]) {
      await paymentToken.connect(u).approve(saleAddress, ethers.MaxUint256);
    }
  });

  it("full happy path: factory creates sale, investors contribute, sale finalizes, treasury receives funds, allocations set, vesting works end-to-end", async () => {
    // Sale is registered and linked to vesting contract
    expect(await sale.vestingContract()).to.equal(await vesting.getAddress());

    // Contribute past soft cap
    await time.increaseTo(startTime);
    await sale.connect(investor1).contribute(ethers.parseUnits("700", 18), []);
    await sale.connect(investor2).contribute(ethers.parseUnits("500", 18), []);

    expect(await sale.totalRaised()).to.equal(ethers.parseUnits("1200", 18));

    // Finalize sale after end
    await time.increaseTo(endTime + 1);
    const treasuryBalBefore = await paymentToken.balanceOf(treasury.address);
    await sale.connect(admin).finalizeSale();
    const treasuryBalAfter = await paymentToken.balanceOf(treasury.address);

    expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseUnits("1200", 18));
    expect(await sale.finalized()).to.be.true;

    // Admin computes token allocations off-chain (contribution / tokenPrice) and sets them on vesting
    const tokenPrice = await sale.tokenPrice();
    const contrib1 = await sale.getUserContribution(investor1.address);
    const contrib2 = await sale.getUserContribution(investor2.address);

    const allocation1 = (contrib1 * ethers.parseUnits("1", 18)) / tokenPrice;
    const allocation2 = (contrib2 * ethers.parseUnits("1", 18)) / tokenPrice;

    await vesting.connect(admin).setAllocations(
      [investor1.address, investor2.address],
      [allocation1, allocation2]
    );

    // Move to vesting start date and claim TGE
    const vestingStartDate = await vesting.vestingStartDate();
    await time.increaseTo(vestingStartDate);

    const tgeAmount1 = allocation1 * BigInt(TGE_PERCENT) / 100n;
    await expect(vesting.connect(investor1).claim())
      .to.emit(vesting, "TokensClaimed")
      .withArgs(investor1.address, tgeAmount1, await time.latest().then(t => t + 1));

    expect(await projectToken.balanceOf(investor1.address)).to.equal(tgeAmount1);

    // Move past cliff + full vesting duration, claim the rest
    await time.increase(CLIFF + DURATION);
    await vesting.connect(investor1).claim();
    expect(await projectToken.balanceOf(investor1.address)).to.equal(allocation1);
  });

  it("refund path: soft cap not reached, investor gets refund, no vesting allocation needed", async () => {
    await time.increaseTo(startTime);
    await sale.connect(investor1).contribute(ethers.parseUnits("200", 18), []); // below soft cap

    await time.increaseTo(endTime + 1);

    // Finalize should fail since soft cap not reached
    await expect(sale.connect(admin).finalizeSale()).to.be.revertedWithCustomError(sale, "SoftCapNotReached");

    // Investor claims refund instead
    const balBefore = await paymentToken.balanceOf(investor1.address);
    await sale.connect(investor1).claimRefund();
    const balAfter = await paymentToken.balanceOf(investor1.address);

    expect(balAfter - balBefore).to.equal(ethers.parseUnits("200", 18));
  });

  it("multiple projects can be created and tracked independently by the factory", async () => {
    const startTime2 = (await time.latest()) + 3600;
    const endTime2 = startTime2 + 7 * 24 * 3600;

    const params2 = {
      projectId: 2,
      tokenAddress: await projectToken.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      treasury: treasury.address,
      startTime: startTime2,
      endTime: endTime2,
      softCap: SOFT_CAP,
      hardCap: HARD_CAP,
      minContribution: ethers.parseUnits("10", 18),
      maxContribution: ethers.parseUnits("2000", 18),
      tokenPrice: ethers.parseUnits("0.5", 18),
      totalAllocation: ethers.parseUnits("10000", 18),
      vestingContract: ethers.ZeroAddress,
      refundEnabled: true,
      whitelistRequired: false,
    };

    await factory.connect(admin).createSale(params2);

    const allSales = await factory.getAllSales();
    expect(allSales.length).to.equal(2);

    const sale1Addr = await factory.getSale(1);
    const sale2Addr = await factory.getSale(2);
    expect(sale1Addr).to.not.equal(sale2Addr);
  });

  it("security guardrail: backend admin cannot redirect sale funds anywhere but treasury", async () => {
    await time.increaseTo(startTime);
    await sale.connect(investor1).contribute(SOFT_CAP, []);
    await time.increaseTo(endTime + 1);

    const adminBalBefore = await paymentToken.balanceOf(admin.address);

    // finalizeSale has no destination parameter — funds always go to the immutable treasury
    await sale.connect(admin).finalizeSale();
    expect(await paymentToken.balanceOf(treasury.address)).to.equal(SOFT_CAP);
    expect(await paymentToken.balanceOf(admin.address)).to.equal(adminBalBefore);
  });
});
