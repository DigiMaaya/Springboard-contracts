const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VestingContract", function () {
  let vesting, token;
  let admin, investor1, investor2, stranger;

  // Vesting params
  const TGE_PERCENT = 10;          // 10% at TGE
  const CLIFF = 30 * 24 * 3600;   // 30 days
  const DURATION = 180 * 24 * 3600; // 180 days
  const INTERVAL = 30 * 24 * 3600; // 30-day intervals → 6 intervals

  const ALLOCATION_1 = ethers.parseUnits("1000", 18);
  const ALLOCATION_2 = ethers.parseUnits("500", 18);

  let vestingStart;

  beforeEach(async () => {
    [admin, investor1, investor2, stranger] = await ethers.getSigners();

    // Deploy a simple ERC20 mock token
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    token = await ERC20Mock.deploy("Mock Token", "MTK", ethers.parseUnits("100000", 18));

    vestingStart = (await time.latest()) + 3600; // TGE in 1 hour

    const Vesting = await ethers.getContractFactory("VestingContract");
    vesting = await Vesting.deploy(
      await token.getAddress(),
      admin.address,
      TGE_PERCENT,
      CLIFF,
      DURATION,
      INTERVAL,
      vestingStart
    );

    // Fund the vesting contract with enough tokens
    await token.transfer(await vesting.getAddress(), ethers.parseUnits("10000", 18));
  });

  // ─────────────────────────────────────────────
  // Deployment
  // ─────────────────────────────────────────────

  describe("Deployment", () => {
    it("sets correct vesting parameters", async () => {
      expect(await vesting.tgePercent()).to.equal(TGE_PERCENT);
      expect(await vesting.cliffDuration()).to.equal(CLIFF);
      expect(await vesting.vestingDuration()).to.equal(DURATION);
      expect(await vesting.vestingInterval()).to.equal(INTERVAL);
      expect(await vesting.vestingStartDate()).to.equal(vestingStart);
    });

    it("grants admin role to deployer", async () => {
      const ADMIN_ROLE = await vesting.ADMIN_ROLE();
      expect(await vesting.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("reverts with zero token address", async () => {
      const Vesting = await ethers.getContractFactory("VestingContract");
      await expect(
        Vesting.deploy(ethers.ZeroAddress, admin.address, TGE_PERCENT, CLIFF, DURATION, INTERVAL, vestingStart)
      ).to.be.revertedWithCustomError(vesting, "ZeroAddress");
    });

    it("reverts with zero admin address", async () => {
      const Vesting = await ethers.getContractFactory("VestingContract");
      await expect(
        Vesting.deploy(await token.getAddress(), ethers.ZeroAddress, TGE_PERCENT, CLIFF, DURATION, INTERVAL, vestingStart)
      ).to.be.revertedWithCustomError(vesting, "ZeroAddress");
    });

    it("reverts if tgePercent > 100", async () => {
      const Vesting = await ethers.getContractFactory("VestingContract");
      await expect(
        Vesting.deploy(await token.getAddress(), admin.address, 101, CLIFF, DURATION, INTERVAL, vestingStart)
      ).to.be.revertedWith("TGE percent exceeds 100");
    });

    it("reverts if vestingInterval is zero", async () => {
      const Vesting = await ethers.getContractFactory("VestingContract");
      await expect(
        Vesting.deploy(await token.getAddress(), admin.address, TGE_PERCENT, CLIFF, DURATION, 0, vestingStart)
      ).to.be.revertedWith("Interval must be > 0");
    });

    it("reverts if vestingDuration is less than vestingInterval", async () => {
      const Vesting = await ethers.getContractFactory("VestingContract");
      await expect(
        Vesting.deploy(await token.getAddress(), admin.address, TGE_PERCENT, CLIFF, INTERVAL - 1, INTERVAL, vestingStart)
      ).to.be.revertedWith("Duration < interval");
    });
  });

  // ─────────────────────────────────────────────
  // setAllocations
  // ─────────────────────────────────────────────

  describe("setAllocations", () => {
    it("sets allocations correctly for multiple investors", async () => {
      await vesting.setAllocations(
        [investor1.address, investor2.address],
        [ALLOCATION_1, ALLOCATION_2]
      );

      const s1 = await vesting.getVestingSchedule(investor1.address);
      expect(s1.totalAllocation).to.equal(ALLOCATION_1);
      expect(s1.tgeAmount).to.equal(ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n);
      expect(s1.initialized).to.be.true;
    });

    it("emits AllocationSet events", async () => {
      await expect(
        vesting.setAllocations([investor1.address], [ALLOCATION_1])
      ).to.emit(vesting, "AllocationSet").withArgs(investor1.address, ALLOCATION_1);
    });

    it("reverts if called by non-admin", async () => {
      await expect(
        vesting.connect(stranger).setAllocations([investor1.address], [ALLOCATION_1])
      ).to.be.reverted;
    });

    it("reverts on array length mismatch", async () => {
      await expect(
        vesting.setAllocations([investor1.address, investor2.address], [ALLOCATION_1])
      ).to.be.revertedWithCustomError(vesting, "ArrayLengthMismatch");
    });

    it("reverts if amount is zero", async () => {
      await expect(
        vesting.setAllocations([investor1.address], [0])
      ).to.be.revertedWithCustomError(vesting, "ZeroAmount");
    });

    it("reverts after allocations are locked", async () => {
      await vesting.lockAllocations();
      await expect(
        vesting.setAllocations([investor1.address], [ALLOCATION_1])
      ).to.be.revertedWithCustomError(vesting, "AllocationsAlreadyLocked");
    });

    it("reverts if a user address is zero", async () => {
      await expect(
        vesting.setAllocations([ethers.ZeroAddress], [ALLOCATION_1])
      ).to.be.revertedWithCustomError(vesting, "ZeroAddress");
    });

    it("reverts lockAllocations if called by non-admin", async () => {
      await expect(vesting.connect(stranger).lockAllocations()).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────
  // vestedAmount — before TGE
  // ─────────────────────────────────────────────

  describe("Before TGE", () => {
    beforeEach(async () => {
      await vesting.setAllocations([investor1.address], [ALLOCATION_1]);
    });

    it("returns 0 vested before TGE", async () => {
      expect(await vesting.vestedAmount(investor1.address)).to.equal(0);
    });

    it("reverts claim before TGE starts", async () => {
      await expect(
        vesting.connect(investor1).claim()
      ).to.be.revertedWithCustomError(vesting, "VestingNotStarted");
    });
  });

  // ─────────────────────────────────────────────
  // TGE unlock
  // ─────────────────────────────────────────────

  describe("TGE unlock", () => {
    beforeEach(async () => {
      await vesting.setAllocations([investor1.address], [ALLOCATION_1]);
      await time.increaseTo(vestingStart);
    });

    it("unlocks exactly TGE% at vestingStart", async () => {
      const expectedTGE = ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n;
      expect(await vesting.vestedAmount(investor1.address)).to.equal(expectedTGE);
      expect(await vesting.claimableAmount(investor1.address)).to.equal(expectedTGE);
    });

    it("investor can claim TGE tokens", async () => {
      const expectedTGE = ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n;
      const balanceBefore = await token.balanceOf(investor1.address);

      await expect(vesting.connect(investor1).claim())
        .to.emit(vesting, "TokensClaimed")
        .withArgs(investor1.address, expectedTGE, await time.latest().then(t => t + 1));

      const balanceAfter = await token.balanceOf(investor1.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedTGE);
    });

    it("nothing more is claimable right after TGE claim", async () => {
      await vesting.connect(investor1).claim();
      expect(await vesting.claimableAmount(investor1.address)).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────
  // Cliff — no extra tokens during cliff
  // ─────────────────────────────────────────────

  describe("Cliff period", () => {
    beforeEach(async () => {
      await vesting.setAllocations([investor1.address], [ALLOCATION_1]);
      await time.increaseTo(vestingStart);
    });

    it("no additional tokens vested during cliff", async () => {
      const tgeAmt = ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n;
      // Jump to middle of cliff
      await time.increase(CLIFF / 2);
      expect(await vesting.vestedAmount(investor1.address)).to.equal(tgeAmt);
    });

    it("cliff end: first interval unlocks after cliff completes", async () => {
      const tgeAmt = ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n;
      const remaining = ALLOCATION_1 - tgeAmt;
      const totalIntervals = DURATION / INTERVAL; // 6

      // Jump exactly to cliff end + 1 interval
      await time.increase(CLIFF + INTERVAL);

      const expectedVested = tgeAmt + (remaining * 1n / BigInt(totalIntervals));
      expect(await vesting.vestedAmount(investor1.address)).to.equal(expectedVested);
    });
  });

  // ─────────────────────────────────────────────
  // Vesting schedule — interval by interval
  // ─────────────────────────────────────────────

  describe("Linear vesting schedule", () => {
    let tgeAmt, remaining;
    const totalIntervals = DURATION / INTERVAL; // 6

    beforeEach(async () => {
      await vesting.setAllocations([investor1.address], [ALLOCATION_1]);
      tgeAmt = ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n;
      remaining = ALLOCATION_1 - tgeAmt;
      await time.increaseTo(vestingStart + CLIFF); // move to cliff end
    });

    for (let i = 1; i <= 6; i++) {
      it(`unlocks correct amount after interval ${i}`, async function () {
        await time.increase(INTERVAL * i);
        const expectedVested = tgeAmt + (remaining * BigInt(i) / BigInt(totalIntervals));
        expect(await vesting.vestedAmount(investor1.address)).to.equal(expectedVested);
      });
    }

    it("returns full allocation after all intervals complete", async () => {
      await time.increase(DURATION + INTERVAL);
      expect(await vesting.vestedAmount(investor1.address)).to.equal(ALLOCATION_1);
    });
  });

  // ─────────────────────────────────────────────
  // Claim accumulation
  // ─────────────────────────────────────────────

  describe("Claim accumulation", () => {
    beforeEach(async () => {
      await vesting.setAllocations([investor1.address], [ALLOCATION_1]);
      await time.increaseTo(vestingStart);
    });

    it("correctly tracks cumulative claims across multiple claims", async () => {
      const tgeAmt = ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n;
      const remaining = ALLOCATION_1 - tgeAmt;

      // Claim TGE
      await vesting.connect(investor1).claim();

      // Move past cliff + 3 intervals
      await time.increase(CLIFF + INTERVAL * 3);

      const expectedExtra = remaining * 3n / 6n;
      expect(await vesting.claimableAmount(investor1.address)).to.equal(expectedExtra);

      await vesting.connect(investor1).claim();

      // Move to full vesting
      await time.increase(DURATION);
      expect(await vesting.claimableAmount(investor1.address)).to.equal(remaining - expectedExtra);
    });

    it("reverts if nothing to claim", async () => {
      await vesting.connect(investor1).claim(); // claim TGE
      // still in cliff, nothing more
      await expect(vesting.connect(investor1).claim())
        .to.be.revertedWithCustomError(vesting, "NothingToClaim");
    });
  });

  // ─────────────────────────────────────────────
  // Stranger / unallocated user
  // ─────────────────────────────────────────────

  describe("Unallocated user", () => {
    it("returns 0 vested for address with no allocation", async () => {
      await time.increaseTo(vestingStart + CLIFF + DURATION);
      expect(await vesting.vestedAmount(stranger.address)).to.equal(0);
    });

    it("reverts claim for address with no allocation", async () => {
      await time.increaseTo(vestingStart);
      await expect(vesting.connect(stranger).claim())
        .to.be.revertedWithCustomError(vesting, "NothingToClaim");
    });
  });

  // ─────────────────────────────────────────────
  // Pause
  // ─────────────────────────────────────────────

  describe("Pause", () => {
    beforeEach(async () => {
      await vesting.setAllocations([investor1.address], [ALLOCATION_1]);
      await time.increaseTo(vestingStart);
    });

    it("blocks claim when paused", async () => {
      await vesting.pauseVesting();
      await expect(vesting.connect(investor1).claim()).to.be.revertedWithCustomError(vesting, "EnforcedPause");
    });

    it("allows claim after unpause", async () => {
      await vesting.pauseVesting();
      await vesting.unpauseVesting();
      await expect(vesting.connect(investor1).claim()).to.emit(vesting, "TokensClaimed");
    });

    it("only admin can pause", async () => {
      await expect(vesting.connect(stranger).pauseVesting()).to.be.reverted;
    });

    it("only admin can unpause", async () => {
      await vesting.pauseVesting();
      await expect(vesting.connect(stranger).unpauseVesting()).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────
  // vestingStartDate not set
  // ─────────────────────────────────────────────

  describe("Vesting start date not set", () => {
    it("reverts claim if vestingStartDate is zero", async () => {
      const Vesting = await ethers.getContractFactory("VestingContract");
      const zeroStartVesting = await Vesting.deploy(
        await token.getAddress(),
        admin.address,
        TGE_PERCENT,
        CLIFF,
        DURATION,
        INTERVAL,
        0
      );
      await zeroStartVesting.setAllocations([investor1.address], [ALLOCATION_1]);
      await expect(zeroStartVesting.connect(investor1).claim())
        .to.be.revertedWithCustomError(zeroStartVesting, "VestingStartDateNotSet");
    });
  });

  // ─────────────────────────────────────────────
  // getVestingSchedule
  // ─────────────────────────────────────────────

  describe("getVestingSchedule", () => {
    it("returns correct schedule data", async () => {
      await vesting.setAllocations([investor1.address], [ALLOCATION_1]);
      const s = await vesting.getVestingSchedule(investor1.address);

      expect(s.totalAllocation).to.equal(ALLOCATION_1);
      expect(s.tgeAmount).to.equal(ALLOCATION_1 * BigInt(TGE_PERCENT) / 100n);
      expect(s.cliffEnd).to.equal(vestingStart + CLIFF);
      expect(s.vestingEnd).to.equal(vestingStart + CLIFF + DURATION);
      expect(s.claimed).to.equal(0);
      expect(s.initialized).to.be.true;
    });
  });
});
