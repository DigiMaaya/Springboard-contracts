const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SpringboardFactory", function () {
  let factory, paymentToken, projectToken;
  let admin, treasury, stranger;

  function baseSaleParams(overrides = {}) {
    return {
      projectId: 1,
      tokenAddress: overrides.tokenAddress || ethers.ZeroAddress,
      paymentToken: overrides.paymentToken || ethers.ZeroAddress,
      treasury: overrides.treasury || ethers.ZeroAddress,
      startTime: overrides.startTime,
      endTime: overrides.endTime,
      softCap: ethers.parseUnits("1000", 18),
      hardCap: ethers.parseUnits("5000", 18),
      minContribution: ethers.parseUnits("10", 18),
      maxContribution: ethers.parseUnits("2000", 18),
      tokenPrice: ethers.parseUnits("0.5", 18),
      totalAllocation: ethers.parseUnits("10000", 18),
      vestingContract: ethers.ZeroAddress,
      refundEnabled: true,
      whitelistRequired: false,
      ...overrides,
    };
  }

  beforeEach(async () => {
    [admin, treasury, stranger] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    paymentToken = await ERC20Mock.deploy("USD Coin", "USDC", ethers.parseUnits("1000000", 18));
    projectToken = await ERC20Mock.deploy("Project Token", "PRJ", ethers.parseUnits("1000000", 18));

    const Factory = await ethers.getContractFactory("SpringboardFactory");
    factory = await Factory.deploy(admin.address);
  });

  async function makeParams(projectId = 1) {
    const startTime = (await time.latest()) + 3600;
    const endTime = startTime + 7 * 24 * 3600;
    return baseSaleParams({
      projectId,
      tokenAddress: await projectToken.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      treasury: treasury.address,
      startTime,
      endTime,
    });
  }

  // ─────────────────────────────────────────────
  // Deployment
  // ─────────────────────────────────────────────

  describe("Deployment", () => {
    it("grants admin role to deployer-specified admin", async () => {
      const ADMIN_ROLE = await factory.ADMIN_ROLE();
      expect(await factory.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("reverts with zero admin address", async () => {
      const Factory = await ethers.getContractFactory("SpringboardFactory");
      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });
  });

  // ─────────────────────────────────────────────
  // createSale
  // ─────────────────────────────────────────────

  describe("createSale", () => {
    it("deploys and registers a new ProjectSale contract", async () => {
      const params = await makeParams(1);
      const tx = await factory.connect(admin).createSale(params);
      const receipt = await tx.wait();

      const saleAddress = await factory.getSale(1);
      expect(saleAddress).to.not.equal(ethers.ZeroAddress);

      const sale = await ethers.getContractAt("ProjectSale", saleAddress);
      expect(await sale.projectId()).to.equal(1);
      expect(await sale.treasury()).to.equal(treasury.address);
    });

    it("emits SaleCreated event", async () => {
      const params = await makeParams(2);
      await expect(factory.connect(admin).createSale(params)).to.emit(factory, "SaleCreated");
    });

    it("adds sale to getAllSales()", async () => {
      const params1 = await makeParams(1);
      const params2 = await makeParams(2);
      await factory.connect(admin).createSale(params1);
      await factory.connect(admin).createSale(params2);

      const allSales = await factory.getAllSales();
      expect(allSales.length).to.equal(2);
    });

    it("reverts if projectId already has a registered sale", async () => {
      const params = await makeParams(1);
      await factory.connect(admin).createSale(params);
      await expect(factory.connect(admin).createSale(params)).to.be.revertedWithCustomError(factory, "SaleAlreadyExists");
    });

    it("reverts if called by non-admin", async () => {
      const params = await makeParams(1);
      await expect(factory.connect(stranger).createSale(params)).to.be.reverted;
    });

    it("reverts when factory is paused", async () => {
      await factory.connect(admin).pauseFactory();
      const params = await makeParams(1);
      await expect(factory.connect(admin).createSale(params)).to.be.revertedWithCustomError(factory, "EnforcedPause");
    });

    it("grants the calling admin ADMIN_ROLE on the deployed sale", async () => {
      const params = await makeParams(1);
      await factory.connect(admin).createSale(params);
      const saleAddress = await factory.getSale(1);
      const sale = await ethers.getContractAt("ProjectSale", saleAddress);
      const SALE_ADMIN_ROLE = await sale.ADMIN_ROLE();
      expect(await sale.hasRole(SALE_ADMIN_ROLE, admin.address)).to.be.true;
    });
  });

  // ─────────────────────────────────────────────
  // getSale / getAllSales
  // ─────────────────────────────────────────────

  describe("getSale / getAllSales", () => {
    it("returns zero address for unregistered projectId", async () => {
      expect(await factory.getSale(999)).to.equal(ethers.ZeroAddress);
    });

    it("returns empty array when no sales exist", async () => {
      const allSales = await factory.getAllSales();
      expect(allSales.length).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────
  // Pause / Unpause
  // ─────────────────────────────────────────────

  describe("pauseFactory / unpauseFactory", () => {
    it("emits FactoryPaused and FactoryUnpaused events", async () => {
      await expect(factory.connect(admin).pauseFactory()).to.emit(factory, "FactoryPaused");
      await expect(factory.connect(admin).unpauseFactory()).to.emit(factory, "FactoryUnpaused");
    });

    it("allows createSale again after unpause", async () => {
      await factory.connect(admin).pauseFactory();
      await factory.connect(admin).unpauseFactory();
      const params = await makeParams(1);
      await expect(factory.connect(admin).createSale(params)).to.not.be.reverted;
    });

    it("reverts if called by non-admin", async () => {
      await expect(factory.connect(stranger).pauseFactory()).to.be.reverted;
      await expect(factory.connect(stranger).unpauseFactory()).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────
  // setImplementation
  // ─────────────────────────────────────────────

  describe("setImplementation", () => {
    it("updates implementation address and emits event", async () => {
      const newImpl = stranger.address; // placeholder address for test
      await expect(factory.connect(admin).setImplementation(newImpl))
        .to.emit(factory, "ImplementationUpdated")
        .withArgs(ethers.ZeroAddress, newImpl, await time.latest().then(t => t + 1));

      expect(await factory.implementation()).to.equal(newImpl);
    });

    it("reverts if called by non-admin", async () => {
      await expect(factory.connect(stranger).setImplementation(stranger.address)).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────
  // transferFactoryAdmin
  // ─────────────────────────────────────────────

  describe("transferFactoryAdmin", () => {
    it("transfers admin and default admin role to new address", async () => {
      await factory.connect(admin).transferFactoryAdmin(stranger.address);

      const ADMIN_ROLE = await factory.ADMIN_ROLE();
      const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();

      expect(await factory.hasRole(ADMIN_ROLE, stranger.address)).to.be.true;
      expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, stranger.address)).to.be.true;
      expect(await factory.hasRole(ADMIN_ROLE, admin.address)).to.be.false;
      expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.false;
    });

    it("emits FactoryAdminTransferred event", async () => {
      await expect(factory.connect(admin).transferFactoryAdmin(stranger.address))
        .to.emit(factory, "FactoryAdminTransferred")
        .withArgs(admin.address, stranger.address, await time.latest().then(t => t + 1));
    });

    it("new admin can create sales after transfer", async () => {
      await factory.connect(admin).transferFactoryAdmin(stranger.address);
      const params = await makeParams(1);
      await expect(factory.connect(stranger).createSale(params)).to.not.be.reverted;
    });

    it("old admin can no longer create sales after transfer", async () => {
      await factory.connect(admin).transferFactoryAdmin(stranger.address);
      const params = await makeParams(1);
      await expect(factory.connect(admin).createSale(params)).to.be.reverted;
    });

    it("reverts on zero address", async () => {
      await expect(factory.connect(admin).transferFactoryAdmin(ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("reverts if called by non-admin", async () => {
      await expect(factory.connect(stranger).transferFactoryAdmin(stranger.address)).to.be.reverted;
    });
  });
});
