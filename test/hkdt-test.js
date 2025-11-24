const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * HKDT合约单元测试
 * 测试覆盖：
 * - 基本铸币和赎回功能
 * - 暂停/恢复机制
 * - 权限控制
 * - 边界情况
 */
describe("HKDT Stablecoin Tests", function () {
  let HKDT, hkdt;
  let owner, user1, user2;

  // 在每个测试前部署新合约
  beforeEach(async function () {
    // 获取测试账户
    [owner, user1, user2] = await ethers.getSigners();

    // 部署合约
    HKDT = await ethers.getContractFactory("HKDT");
    hkdt = await HKDT.deploy();
    await hkdt.waitForDeployment();
  });

  describe("基础功能测试", function () {
    it("应该正确设置代币名称和符号", async function () {
      expect(await hkdt.name()).to.equal("HongKong Dollar Token");
      expect(await hkdt.symbol()).to.equal("HKDT");
      expect(await hkdt.decimals()).to.equal(18);
    });

    it("初始总供应量应该为0", async function () {
      expect(await hkdt.totalSupply()).to.equal(0);
    });

    it("owner应该可以铸币给用户", async function () {
      const amount = ethers.parseUnits("100", 18); // 100 HKDT

      // 铸币前检查余额
      expect(await hkdt.balanceOf(user1.address)).to.equal(0);

      // owner铸币给user1
      await expect(hkdt.connect(owner).mint(user1.address, amount))
        .to.emit(hkdt, "Minted")
        .withArgs(user1.address, amount);

      // 检查余额和总供应量
      expect(await hkdt.balanceOf(user1.address)).to.equal(amount);
      expect(await hkdt.totalSupply()).to.equal(amount);
    });

    it("用户应该可以赎回（销毁）HKDT", async function () {
      const mintAmount = ethers.parseUnits("100", 18);
      const redeemAmount = ethers.parseUnits("50", 18);

      // 先铸币
      await hkdt.connect(owner).mint(user1.address, mintAmount);
      expect(await hkdt.balanceOf(user1.address)).to.equal(mintAmount);

      // 用户赎回
      await expect(
        hkdt.connect(user1).redeem(redeemAmount, "bank-ref-001")
      )
        .to.emit(hkdt, "Redeemed")
        .withArgs(user1.address, redeemAmount, "bank-ref-001");

      // 检查余额减少
      const expectedBalance = mintAmount - redeemAmount;
      expect(await hkdt.balanceOf(user1.address)).to.equal(expectedBalance);
      expect(await hkdt.totalSupply()).to.equal(expectedBalance);
    });

    it("用户之间可以正常转账", async function () {
      const amount = ethers.parseUnits("100", 18);
      const transferAmount = ethers.parseUnits("30", 18);

      // 铸币给user1
      await hkdt.connect(owner).mint(user1.address, amount);

      // user1转账给user2
      await hkdt.connect(user1).transfer(user2.address, transferAmount);

      // 检查余额
      expect(await hkdt.balanceOf(user1.address)).to.equal(amount - transferAmount);
      expect(await hkdt.balanceOf(user2.address)).to.equal(transferAmount);
    });
  });

  describe("权限控制测试", function () {
    it("非owner不能铸币", async function () {
      const amount = ethers.parseUnits("100", 18);

      await expect(
        hkdt.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(hkdt, "OwnableUnauthorizedAccount");
    });

    it("只有owner可以暂停合约", async function () {
      await expect(
        hkdt.connect(user1).pause()
      ).to.be.revertedWithCustomError(hkdt, "OwnableUnauthorizedAccount");

      // owner可以暂停
      await hkdt.connect(owner).pause();
      expect(await hkdt.paused()).to.be.true;
    });

    it("只有owner可以恢复合约", async function () {
      await hkdt.connect(owner).pause();

      await expect(
        hkdt.connect(user1).unpause()
      ).to.be.revertedWithCustomError(hkdt, "OwnableUnauthorizedAccount");

      // owner可以恢复
      await hkdt.connect(owner).unpause();
      expect(await hkdt.paused()).to.be.false;
    });
  });

  describe("暂停机制测试", function () {
    it("暂停后不能转账", async function () {
      const amount = ethers.parseUnits("100", 18);

      // 铸币并转账
      await hkdt.connect(owner).mint(user1.address, amount);
      await hkdt.connect(owner).pause();

      // 暂停后转账应该失败
      await expect(
        hkdt.connect(user1).transfer(user2.address, amount)
      ).to.be.revertedWithCustomError(hkdt, "EnforcedPause");
    });

    it("暂停后不能铸币", async function () {
      const amount = ethers.parseUnits("100", 18);

      await hkdt.connect(owner).pause();

      await expect(
        hkdt.connect(owner).mint(user1.address, amount)
      ).to.be.revertedWithCustomError(hkdt, "EnforcedPause");
    });

    it("暂停后不能赎回", async function () {
      const amount = ethers.parseUnits("100", 18);

      await hkdt.connect(owner).mint(user1.address, amount);
      await hkdt.connect(owner).pause();

      await expect(
        hkdt.connect(user1).redeem(amount, "bank-ref")
      ).to.be.revertedWithCustomError(hkdt, "EnforcedPause");
    });

    it("恢复后可以正常操作", async function () {
      const amount = ethers.parseUnits("100", 18);

      // 暂停
      await hkdt.connect(owner).pause();

      // 恢复
      await hkdt.connect(owner).unpause();

      // 应该可以正常铸币
      await hkdt.connect(owner).mint(user1.address, amount);
      expect(await hkdt.balanceOf(user1.address)).to.equal(amount);
    });
  });

  describe("边界情况和错误处理", function () {
    it("不能给零地址铸币", async function () {
      const amount = ethers.parseUnits("100", 18);

      await expect(
        hkdt.connect(owner).mint(ethers.ZeroAddress, amount)
      ).to.be.revertedWith("HKDT: cannot mint to zero address");
    });

    it("不能铸造0数量的代币", async function () {
      await expect(
        hkdt.connect(owner).mint(user1.address, 0)
      ).to.be.revertedWith("HKDT: amount must be greater than 0");
    });

    it("余额不足时不能赎回", async function () {
      const amount = ethers.parseUnits("100", 18);

      await expect(
        hkdt.connect(user1).redeem(amount, "bank-ref")
      ).to.be.revertedWith("HKDT: insufficient balance");
    });

    it("不能赎回0数量", async function () {
      await hkdt.connect(owner).mint(user1.address, ethers.parseUnits("100", 18));

      await expect(
        hkdt.connect(user1).redeem(0, "bank-ref")
      ).to.be.revertedWith("HKDT: amount must be greater than 0");
    });

    it("赎回时bankRef不能为空", async function () {
      const amount = ethers.parseUnits("100", 18);
      await hkdt.connect(owner).mint(user1.address, amount);

      await expect(
        hkdt.connect(user1).redeem(amount, "")
      ).to.be.revertedWith("HKDT: bankRef cannot be empty");
    });
  });

  describe("完整流程测试", function () {
    it("完整的铸币-转账-赎回流程", async function () {
      const mintAmount = ethers.parseUnits("1000", 18);
      const transferAmount = ethers.parseUnits("300", 18);
      const redeemAmount = ethers.parseUnits("200", 18);

      // 1. 铸币给user1
      await hkdt.connect(owner).mint(user1.address, mintAmount);
      expect(await hkdt.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await hkdt.totalSupply()).to.equal(mintAmount);

      // 2. user1转账给user2
      await hkdt.connect(user1).transfer(user2.address, transferAmount);
      expect(await hkdt.balanceOf(user1.address)).to.equal(mintAmount - transferAmount);
      expect(await hkdt.balanceOf(user2.address)).to.equal(transferAmount);

      // 3. user1赎回部分代币
      await hkdt.connect(user1).redeem(redeemAmount, "bank-ref-001");
      expect(await hkdt.balanceOf(user1.address)).to.equal(
        mintAmount - transferAmount - redeemAmount
      );
      expect(await hkdt.totalSupply()).to.equal(mintAmount - redeemAmount);

      // 4. user2也赎回
      await hkdt.connect(user2).redeem(transferAmount, "bank-ref-002");
      expect(await hkdt.balanceOf(user2.address)).to.equal(0);
      expect(await hkdt.totalSupply()).to.equal(mintAmount - redeemAmount - transferAmount);
    });
  });
});


