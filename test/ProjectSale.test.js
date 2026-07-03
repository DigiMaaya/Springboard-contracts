const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

describe("ProjectSale", function () {
  let sale, paymentToken, projectToken;
  let admin, treasury, multisig, user1, user2, user3, stranger;

  const SOFT_CAP = ethers.parseUnits("1000", 18);
  const HARD_CAP = ethers.parseUnits("5000", 18);
  const MIN_CONTRIBUTION = ethers.parseUnits("10", 18);
  const MAX_CONTRIBUTION = ethers.parseUnits("2000", 18);
  const TOKEN_PRICE = ethers.parseUnits("0.5", 18);
  const TOTAL_ALLOCATION = ethers.parseUnits("10000", 18);

  let startTime, endTime;

  async function deploySale({
    softCap = SOFT_CAP,
    hardCap = HARD_CAP,
    refundEnabled = true,
    whitelistRequired = false,
  } = {}) {
    startTime = (await time.latest()) + 3600; // starts in 1 hour
    endTime = startTime + 7 * 24 * 3600; // 7 day sale

    const Sale = await ethers.getContractFactory("ProjectSale");
    const saleParams = {
      projectId: 1,
      tokenAddress: await projectToken.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      treasury: treasury.address,
      startTime,
      endTime,
      softCap,
      hardCap,
      minContribution: MIN_CONTRIBUTION,
      maxContribution: MAX_CONTRIBUTION,
      tokenPrice: TOKEN_PRICE,
      totalAllocation: TOTAL_ALLOCATION,
      vestingContract: ethers.ZeroAddress,
      refundEnabled,
      whitelistRequired,
      admin: admin.address,
    };
    const deployed = await Sale.deploy(saleParams);

    const MULTISIG_ROLE = await deployed.MULTISIG_ROLE();
    await deployed.connect(admin).grantRole(MULTISIG_ROLE, multisig.address);

    return deployed;
  }

  beforeEach(async () => {
    [admin, treasury, multisig, user1, user2, user3, stranger] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    paymentToken = await ERC20Mock.deploy("USD Coin", "USDC", ethers.parseUnits("1000000", 18));
    projectToken = await ERC20Mock.deploy("Project Token", "PRJ", ethers.parseUnits("1000000", 18));

    // Distribute payment tokens to users
    for (const u of [user1, user2, user3, stranger]) {
      await paymentToken.transfer(u.address, ethers.parseUnits("5000", 18));
    }

    sale = await deploySale();

    // Approve sale contract for all users
    for (const u of [user1, user2, user3, stranger]) {
      await paymentToken.connect(u).approve(await sale.getAddress(), ethers.MaxUint256);
    }
  });

  // ─────────────────────────────────────────────
  // Deployment
  // ─────────────────────────────────────────────

  describe("Deployment", () => {
    it("sets correct immutable sale parameters", async () => {
      expect(await sale.projectId()).to.equal(1);
      expect(await sale.softCap()).to.equal(SOFT_CAP);
      expect(await sale.hardCap()).to.equal(HARD_CAP);
      expect(await sale.treasury()).to.equal(treasury.address);
    });

    it("grants admin role to admin address", async () => {
      const ADMIN_ROLE = await sale.ADMIN_ROLE();
      expect(await sale.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("reverts if startTime >= endTime", async () => {
      const Sale = await ethers.getContractFactory("ProjectSale");
      const badParams = {
        projectId: 1,
        tokenAddress: await projectToken.getAddress(),
        paymentToken: await paymentToken.getAddress(),
        treasury: treasury.address,
        startTime: 100,
        endTime: 100,
        softCap: SOFT_CAP,
        hardCap: HARD_CAP,
        minContribution: MIN_CONTRIBUTION,
        maxContribution: MAX_CONTRIBUTION,
        tokenPrice: TOKEN_PRICE,
        totalAllocation: TOTAL_ALLOCATION,
        vestingContract: ethers.ZeroAddress,
        refundEnabled: true,
        whitelistRequired: false,
        admin: admin.address,
      };
      await expect(Sale.deploy(badParams)).to.be.revertedWithCustomError(sale, "InvalidTimeRange");
    });

    it("reverts if softCap > hardCap", async () => {
      await expect(
        deploySale({ softCap: HARD_CAP + 1n, hardCap: HARD_CAP })
      ).to.be.revertedWithCustomError(sale, "InvalidCaps");
    });
  });

  // ─────────────────────────────────────────────
  // Contribution flow
  // ─────────────────────────────────────────────

  describe("Contribution flow", () => {
    beforeEach(async () => {
      await time.increaseTo(startTime);
    });

    it("accepts a valid contribution", async () => {
      const amount = ethers.parseUnits("100", 18);
      await expect(sale.connect(user1).contribute(amount, []))
        .to.emit(sale, "ContributionReceived")
        .withArgs(user1.address, amount, await time.latest().then(t => t + 1));

      expect(await sale.getUserContribution(user1.address)).to.equal(amount);
      expect(await sale.totalRaised()).to.equal(amount);
      expect(await sale.participantCount()).to.equal(1);
    });

    it("accumulates multiple contributions from same user without double counting participant", async () => {
      await sale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
      await sale.connect(user1).contribute(ethers.parseUnits("50", 18), []);

      expect(await sale.getUserContribution(user1.address)).to.equal(ethers.parseUnits("150", 18));
      expect(await sale.participantCount()).to.equal(1);
    });

    it("tracks participant count across multiple users", async () => {
      await sale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
      await sale.connect(user2).contribute(ethers.parseUnits("100", 18), []);

      expect(await sale.participantCount()).to.equal(2);
    });

    it("reverts before sale start", async () => {
      const freshSale = await deploySale();
      await paymentToken.connect(user1).approve(await freshSale.getAddress(), ethers.MaxUint256);
      await expect(
        freshSale.connect(user1).contribute(ethers.parseUnits("100", 18), [])
      ).to.be.revertedWithCustomError(freshSale, "SaleNotActive");
    });

    it("reverts after sale end", async () => {
      await time.increaseTo(endTime + 1);
      await expect(
        sale.connect(user1).contribute(ethers.parseUnits("100", 18), [])
      ).to.be.revertedWithCustomError(sale, "SaleNotActive");
    });

    it("reverts on zero amount", async () => {
      await expect(sale.connect(user1).contribute(0, [])).to.be.revertedWithCustomError(sale, "ZeroAmount");
    });

    it("transfers payment tokens from contributor to sale contract", async () => {
      const amount = ethers.parseUnits("100", 18);
      const balBefore = await paymentToken.balanceOf(await sale.getAddress());
      await sale.connect(user1).contribute(amount, []);
      const balAfter = await paymentToken.balanceOf(await sale.getAddress());
      expect(balAfter - balBefore).to.equal(amount);
    });
  });

  // ─────────────────────────────────────────────
  // Min/Max contribution enforcement
  // ─────────────────────────────────────────────

  describe("Min/Max contribution enforcement", () => {
    beforeEach(async () => {
      await time.increaseTo(startTime);
    });

    it("reverts if contribution below minContribution", async () => {
      await expect(
        sale.connect(user1).contribute(ethers.parseUnits("5", 18), [])
      ).to.be.revertedWithCustomError(sale, "ContributionOutOfRange");
    });

    it("reverts if cumulative contribution exceeds maxContribution", async () => {
      await sale.connect(user1).contribute(ethers.parseUnits("1000", 18), []);
      await expect(
        sale.connect(user1).contribute(ethers.parseUnits("1500", 18), [])
      ).to.be.revertedWithCustomError(sale, "ContributionOutOfRange");
    });

    it("allows contribution exactly at minContribution", async () => {
      await expect(sale.connect(user1).contribute(MIN_CONTRIBUTION, [])).to.not.be.reverted;
    });

    it("allows cumulative contribution exactly at maxContribution", async () => {
      await expect(sale.connect(user1).contribute(MAX_CONTRIBUTION, [])).to.not.be.reverted;
    });
  });

  // ─────────────────────────────────────────────
  // Hard cap enforcement
  // ─────────────────────────────────────────────

  describe("Hard cap enforcement", () => {
    beforeEach(async () => {
      await time.increaseTo(startTime);
    });

    it("reverts contribution exceeding hard cap", async () => {
      // Fund several large contributors to approach hard cap (5000)
      await sale.connect(user1).contribute(MAX_CONTRIBUTION, []); // 2000
      await sale.connect(user2).contribute(MAX_CONTRIBUTION, []); // 2000 -> total 4000
      // user3 tries 1500 -> would exceed hard cap of 5000
      await expect(
        sale.connect(user3).contribute(ethers.parseUnits("1500", 18), [])
      ).to.be.revertedWithCustomError(sale, "HardCapExceeded");
    });

    it("allows contribution that exactly reaches hard cap", async () => {
      await sale.connect(user1).contribute(MAX_CONTRIBUTION, []); // 2000
      await sale.connect(user2).contribute(MAX_CONTRIBUTION, []); // 2000 -> total 4000
      await expect(
        sale.connect(user3).contribute(ethers.parseUnits("1000", 18), [])
      ).to.not.be.reverted; // total exactly 5000
      expect(await sale.totalRaised()).to.equal(HARD_CAP);
    });
  });

  // ─────────────────────────────────────────────
  // Whitelist enforcement (Merkle proof)
  // ─────────────────────────────────────────────

  describe("Whitelist enforcement", () => {
    let tree, whitelistedSale;

    beforeEach(async () => {
      const values = [[user1.address], [user2.address]];
      tree = StandardMerkleTree.of(values, ["address"]);

      whitelistedSale = await deploySale({ whitelistRequired: true });
      await whitelistedSale.connect(admin).setWhitelistRoot(tree.root);

      for (const u of [user1, user2, user3, stranger]) {
        await paymentToken.connect(u).approve(await whitelistedSale.getAddress(), ethers.MaxUint256);
      }

      await time.increaseTo(startTime);
    });

    function proofFor(address) {
      for (const [i, v] of tree.entries()) {
        if (v[0] === address) {
          return tree.getProof(i);
        }
      }
      throw new Error("address not in tree");
    }

    it("allows whitelisted user to contribute with valid proof", async () => {
      const proof = proofFor(user1.address);
      await expect(
        whitelistedSale.connect(user1).contribute(ethers.parseUnits("100", 18), proof)
      ).to.not.be.reverted;
    });

    it("rejects non-whitelisted user", async () => {
      await expect(
        whitelistedSale.connect(user3).contribute(ethers.parseUnits("100", 18), [])
      ).to.be.revertedWithCustomError(whitelistedSale, "NotWhitelisted");
    });

    it("rejects whitelisted user using wrong proof", async () => {
      const wrongProof = proofFor(user2.address);
      await expect(
        whitelistedSale.connect(user1).contribute(ethers.parseUnits("100", 18), wrongProof)
      ).to.be.revertedWithCustomError(whitelistedSale, "NotWhitelisted");
    });

    it("only admin can update whitelist root", async () => {
      await expect(
        whitelistedSale.connect(stranger).setWhitelistRoot(ethers.ZeroHash)
      ).to.be.reverted;
    });

    it("emits WhitelistRootUpdated event", async () => {
      await expect(whitelistedSale.connect(admin).setWhitelistRoot(ethers.ZeroHash))
        .to.emit(whitelistedSale, "WhitelistRootUpdated");
    });
  });

  // ─────────────────────────────────────────────
  // Soft cap failure and refund
  // ─────────────────────────────────────────────

  describe("Soft cap failure and refund", () => {
    beforeEach(async () => {
      await time.increaseTo(startTime);
      // Contribute well below soft cap
      await sale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
      await time.increaseTo(endTime + 1);
    });

    it("allows refund claim when soft cap not reached", async () => {
      const balBefore = await paymentToken.balanceOf(user1.address);
      await expect(sale.connect(user1).claimRefund())
        .to.emit(sale, "RefundClaimed")
        .withArgs(user1.address, ethers.parseUnits("100", 18), await time.latest().then(t => t + 1));

      const balAfter = await paymentToken.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(ethers.parseUnits("100", 18));
      expect(await sale.contributions(user1.address)).to.equal(0);
    });

    it("reverts double refund claim", async () => {
      await sale.connect(user1).claimRefund();
      await expect(sale.connect(user1).claimRefund()).to.be.revertedWithCustomError(sale, "AlreadyRefunded");
    });

    it("reverts refund claim for user with no contribution", async () => {
      await expect(sale.connect(stranger).claimRefund()).to.be.revertedWithCustomError(sale, "NoContribution");
    });

    it("reverts refund claim before sale ends", async () => {
      const freshSale = await deploySale();
      await paymentToken.connect(user1).approve(await freshSale.getAddress(), ethers.MaxUint256);
      await time.increaseTo(startTime);
      await freshSale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
      await expect(freshSale.connect(user1).claimRefund()).to.be.revertedWithCustomError(freshSale, "SaleNotEnded");
    });

    it("reverts refund if refundEnabled is false", async () => {
      const noRefundSale = await deploySale({ refundEnabled: false });
      await paymentToken.connect(user1).approve(await noRefundSale.getAddress(), ethers.MaxUint256);
      await time.increaseTo(startTime);
      await noRefundSale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
      await time.increaseTo(endTime + 1);
      await expect(noRefundSale.connect(user1).claimRefund()).to.be.revertedWithCustomError(noRefundSale, "RefundNotEnabled");
    });

    it("reverts refund if soft cap was reached", async () => {
      const goodSale = await deploySale();
      await paymentToken.connect(user1).approve(await goodSale.getAddress(), ethers.MaxUint256);
      await time.increaseTo(startTime);
      await goodSale.connect(user1).contribute(SOFT_CAP, []);
      await time.increaseTo(endTime + 1);
      await expect(goodSale.connect(user1).claimRefund()).to.be.revertedWithCustomError(goodSale, "SoftCapReached");
    });
  });

  // ─────────────────────────────────────────────
  // Finalization and treasury transfer
  // ─────────────────────────────────────────────

  describe("Finalization and treasury transfer", () => {
    beforeEach(async () => {
      await time.increaseTo(startTime);
      await sale.connect(user1).contribute(SOFT_CAP, []); // meets soft cap exactly
    });

    it("reverts finalize before sale ends", async () => {
      await expect(sale.connect(admin).finalizeSale()).to.be.revertedWithCustomError(sale, "SaleNotEnded");
    });

    it("reverts finalize if soft cap not reached", async () => {
      const lowSale = await deploySale();
      await paymentToken.connect(user1).approve(await lowSale.getAddress(), ethers.MaxUint256);
      await time.increaseTo(startTime);
      await lowSale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
      await time.increaseTo(endTime + 1);
      await expect(lowSale.connect(admin).finalizeSale()).to.be.revertedWithCustomError(lowSale, "SoftCapNotReached");
    });

    it("finalizes sale and transfers funds to treasury", async () => {
      await time.increaseTo(endTime + 1);
      const treasuryBalBefore = await paymentToken.balanceOf(treasury.address);

      await expect(sale.connect(admin).finalizeSale())
        .to.emit(sale, "SaleFinalized")
        .withArgs(SOFT_CAP, 1, await time.latest().then(t => t + 1));

      const treasuryBalAfter = await paymentToken.balanceOf(treasury.address);
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(SOFT_CAP);
      expect(await sale.finalized()).to.be.true;
    });

    it("reverts double finalization", async () => {
      await time.increaseTo(endTime + 1);
      await sale.connect(admin).finalizeSale();
      await expect(sale.connect(admin).finalizeSale()).to.be.revertedWithCustomError(sale, "SaleAlreadyFinalized");
    });

    it("only admin can finalize", async () => {
      await time.increaseTo(endTime + 1);
      await expect(sale.connect(stranger).finalizeSale()).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────
  // Pause / Unpause
  // ─────────────────────────────────────────────

  describe("Pause and unpause", () => {
    beforeEach(async () => {
      await time.increaseTo(startTime);
    });

    it("blocks contribution when paused", async () => {
      await sale.connect(admin).pauseSale();
      await expect(
        sale.connect(user1).contribute(ethers.parseUnits("100", 18), [])
      ).to.be.revertedWithCustomError(sale, "EnforcedPause");
    });

    it("allows contribution after unpause", async () => {
      await sale.connect(admin).pauseSale();
      await sale.connect(admin).unpauseSale();
      await expect(sale.connect(user1).contribute(ethers.parseUnits("100", 18), [])).to.not.be.reverted;
    });

    it("emits SalePaused and SaleUnpaused events", async () => {
      await expect(sale.connect(admin).pauseSale()).to.emit(sale, "SalePaused");
      await expect(sale.connect(admin).unpauseSale()).to.emit(sale, "SaleUnpaused");
    });

    it("only admin can pause/unpause", async () => {
      await expect(sale.connect(stranger).pauseSale()).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────
  // getSaleStatus
  // ─────────────────────────────────────────────

  describe("getSaleStatus", () => {
    it("returns Pending before start", async () => {
      const status = await sale.getSaleStatus();
      expect(status.status).to.equal(0); // Pending
    });

    it("returns Active during sale window", async () => {
      await time.increaseTo(startTime);
      const status = await sale.getSaleStatus();
      expect(status.status).to.equal(1); // Active
    });

    it("returns Ended after sale window with no finalize", async () => {
      await time.increaseTo(endTime + 1);
      const status = await sale.getSaleStatus();
      expect(status.status).to.equal(2); // Ended
    });

    it("returns Finalized after finalizeSale", async () => {
      await time.increaseTo(startTime);
      await sale.connect(user1).contribute(SOFT_CAP, []);
      await time.increaseTo(endTime + 1);
      await sale.connect(admin).finalizeSale();
      const status = await sale.getSaleStatus();
      expect(status.status).to.equal(3); // Finalized
    });

    it("reflects correct raised amount and participant count", async () => {
      await time.increaseTo(startTime);
      await sale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
      await sale.connect(user2).contribute(ethers.parseUnits("200", 18), []);
      const status = await sale.getSaleStatus();
      expect(status.raised).to.equal(ethers.parseUnits("300", 18));
      expect(status.participants).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────
  // Emergency controls
  // ─────────────────────────────────────────────

  describe("Emergency controls", () => {
    beforeEach(async () => {
      await time.increaseTo(startTime);
      await sale.connect(user1).contribute(ethers.parseUnits("100", 18), []);
    });

    it("allows multisig to emergency withdraw funds to treasury", async () => {
      const treasuryBalBefore = await paymentToken.balanceOf(treasury.address);
      await expect(sale.connect(multisig).emergencyWithdraw())
        .to.emit(sale, "EmergencyWithdraw")
        .withArgs(multisig.address, ethers.parseUnits("100", 18), await time.latest().then(t => t + 1));

      const treasuryBalAfter = await paymentToken.balanceOf(treasury.address);
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseUnits("100", 18));
    });

    it("reverts emergency withdraw from backend admin (not multisig)", async () => {
      await expect(sale.connect(admin).emergencyWithdraw()).to.be.reverted;
    });

    it("reverts emergency withdraw from stranger", async () => {
      await expect(sale.connect(stranger).emergencyWithdraw()).to.be.reverted;
    });

    it("reverts if there is nothing to withdraw", async () => {
      await sale.connect(multisig).emergencyWithdraw();
      await expect(sale.connect(multisig).emergencyWithdraw()).to.be.revertedWithCustomError(sale, "ZeroAmount");
    });
  });
});
