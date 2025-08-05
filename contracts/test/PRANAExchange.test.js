const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PRANAExchange", function () {
  // Constants
  const PRANA_PRICE = 100000; // 0.10 USDT
  const MIN_BUY_AMOUNT = ethers.utils.parseUnits("50", 6); // 50 USDT
  const MIN_SELL_AMOUNT = ethers.utils.parseEther("1000"); // 1000 PRANA

  async function deployExchangeFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy PRANA Token
    const PRANAToken = await ethers.getContractFactory("PRANAToken");
    const pranaToken = await PRANAToken.deploy();

    // Deploy Mock USDT
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdtToken = await MockERC20.deploy(
      "Tether USD",
      "USDT",
      6,
      ethers.utils.parseUnits("1000000000", 6) // 1B USDT
    );

    // Deploy Exchange
    const PRANAExchange = await ethers.getContractFactory("PRANAExchange");
    const pranaExchange = await PRANAExchange.deploy(
      pranaToken.address,
      usdtToken.address
    );

    // Setup initial liquidity
    const pranaLiquidity = ethers.utils.parseEther("1000000"); // 1M PRANA
    const usdtLiquidity = ethers.utils.parseUnits("100000", 6); // 100K USDT

    // Transfer tokens to owner for liquidity
    await pranaToken.transfer(owner.address, pranaLiquidity);
    await usdtToken.transfer(owner.address, usdtLiquidity);

    // Approve and add liquidity
    await pranaToken.approve(pranaExchange.address, pranaLiquidity);
    await usdtToken.approve(pranaExchange.address, usdtLiquidity);
    await pranaExchange.addLiquidity(pranaLiquidity, usdtLiquidity);

    // Give test addresses some tokens
    await usdtToken.transfer(addr1.address, ethers.utils.parseUnits("10000", 6));
    await pranaToken.transfer(addr1.address, ethers.utils.parseEther("10000"));

    return { 
      pranaToken, 
      usdtToken, 
      pranaExchange, 
      owner, 
      addr1, 
      addr2, 
      addr3,
      pranaLiquidity,
      usdtLiquidity
    };
  }

  describe("Deployment", function () {
    it("Should set correct token addresses", async function () {
      const { pranaToken, usdtToken, pranaExchange } = await loadFixture(deployExchangeFixture);

      expect(await pranaExchange.pranaToken()).to.equal(pranaToken.address);
      expect(await pranaExchange.usdtToken()).to.equal(usdtToken.address);
    });

    it("Should set correct constants", async function () {
      const { pranaExchange } = await loadFixture(deployExchangeFixture);

      expect(await pranaExchange.PRANA_PRICE()).to.equal(PRANA_PRICE);
      expect(await pranaExchange.MIN_BUY_AMOUNT()).to.equal(MIN_BUY_AMOUNT);
      expect(await pranaExchange.MIN_SELL_AMOUNT()).to.equal(MIN_SELL_AMOUNT);
    });

    it("Should have initial liquidity", async function () {
      const { pranaExchange, pranaLiquidity, usdtLiquidity } = await loadFixture(deployExchangeFixture);

      const [pranaReserve, usdtReserve] = await pranaExchange.getReserves();
      expect(pranaReserve).to.equal(pranaLiquidity);
      expect(usdtReserve).to.equal(usdtLiquidity);
    });
  });

  describe("Buying PRANA", function () {
    it("Should buy PRANA with USDT", async function () {
      const { pranaExchange, usdtToken, pranaToken, addr1 } = await loadFixture(deployExchangeFixture);

      const usdtAmount = ethers.utils.parseUnits("100", 6); // 100 USDT
      const expectedPrana = usdtAmount.mul(ethers.utils.parseEther("1")).div(PRANA_PRICE);

      // Approve USDT
      await usdtToken.connect(addr1).approve(pranaExchange.address, usdtAmount);

      // Buy PRANA
      await expect(
        pranaExchange.connect(addr1).buyPRANA(usdtAmount)
      )
        .to.emit(pranaExchange, "PRANAPurchased")
        .withArgs(addr1.address, usdtAmount, expectedPrana, 0, await ethers.provider.getBlockNumber() + 1);

      // Check balances
      expect(await pranaToken.balanceOf(addr1.address)).to.be.closeTo(
        ethers.utils.parseEther("10000").add(expectedPrana),
        ethers.utils.parseEther("1") // Small tolerance for precision
      );
    });

    it("Should revert buy below minimum amount", async function () {
      const { pranaExchange, usdtToken, addr1 } = await loadFixture(deployExchangeFixture);

      const smallAmount = ethers.utils.parseUnits("10", 6); // 10 USDT (below 50 minimum)

      await usdtToken.connect(addr1).approve(pranaExchange.address, smallAmount);

      await expect(
        pranaExchange.connect(addr1).buyPRANA(smallAmount)
      ).to.be.revertedWith("Exchange: below minimum buy amount");
    });

    it("Should revert buy with insufficient reserves", async function () {
      const { pranaExchange, usdtToken, addr1 } = await loadFixture(deployExchangeFixture);

      // Try to buy more PRANA than available in reserves
      const massiveAmount = ethers.utils.parseUnits("10000000", 6); // 10M USDT

      await usdtToken.mint(addr1.address, massiveAmount);
      await usdtToken.connect(addr1).approve(pranaExchange.address, massiveAmount);

      await expect(
        pranaExchange.connect(addr1).buyPRANA(massiveAmount)
      ).to.be.revertedWith("Exchange: insufficient PRANA reserve");
    });

    it("Should get correct buy quote", async function () {
      const { pranaExchange } = await loadFixture(deployExchangeFixture);

      const usdtAmount = ethers.utils.parseUnits("100", 6);
      const [pranaAmount, fee] = await pranaExchange.getBuyQuote(usdtAmount);

      const expectedPrana = usdtAmount.mul(ethers.utils.parseEther("1")).div(PRANA_PRICE);
      expect(pranaAmount).to.equal(expectedPrana);
      expect(fee).to.equal(0); // No fee initially
    });
  });

  describe("Selling PRANA", function () {
    it("Should sell PRANA for USDT", async function () {
      const { pranaExchange, usdtToken, pranaToken, addr1 } = await loadFixture(deployExchangeFixture);

      const pranaAmount = ethers.utils.parseEther("2000"); // 2000 PRANA
      const expectedUsdt = pranaAmount.mul(PRANA_PRICE).div(ethers.utils.parseEther("1"));

      // Approve PRANA
      await pranaToken.connect(addr1).approve(pranaExchange.address, pranaAmount);

      // Sell PRANA
      await expect(
        pranaExchange.connect(addr1).sellPRANA(pranaAmount)
      )
        .to.emit(pranaExchange, "PRANASold")
        .withArgs(addr1.address, pranaAmount, expectedUsdt, 0, await ethers.provider.getBlockNumber() + 1);

      // Check balances
      expect(await usdtToken.balanceOf(addr1.address)).to.be.closeTo(
        ethers.utils.parseUnits("10000", 6).add(expectedUsdt),
        ethers.utils.parseUnits("1", 6) // Small tolerance
      );
    });

    it("Should revert sell below minimum amount", async function () {
      const { pranaExchange, pranaToken, addr1 } = await loadFixture(deployExchangeFixture);

      const smallAmount = ethers.utils.parseEther("100"); // 100 PRANA (below 1000 minimum)

      await pranaToken.connect(addr1).approve(pranaExchange.address, smallAmount);

      await expect(
        pranaExchange.connect(addr1).sellPRANA(smallAmount)
      ).to.be.revertedWith("Exchange: below minimum sell amount");
    });

    it("Should revert sell with insufficient USDT reserves", async function () {
      const { pranaExchange, pranaToken, addr1, owner } = await loadFixture(deployExchangeFixture);

      // Remove most USDT liquidity to create shortage
      const [, usdtReserve] = await pranaExchange.getReserves();
      await pranaExchange.removeLiquidity(0, usdtReserve.mul(99).div(100));

      const largeAmount = ethers.utils.parseEther("50000"); // Large amount
      await pranaToken.transfer(addr1.address, largeAmount);
      await pranaToken.connect(addr1).approve(pranaExchange.address, largeAmount);

      await expect(
        pranaExchange.connect(addr1).sellPRANA(largeAmount)
      ).to.be.revertedWith("Exchange: insufficient USDT reserve");
    });

    it("Should get correct sell quote", async function () {
      const { pranaExchange } = await loadFixture(deployExchangeFixture);

      const pranaAmount = ethers.utils.parseEther("2000");
      const [usdtAmount, fee] = await pranaExchange.getSellQuote(pranaAmount);

      const expectedUsdt = pranaAmount.mul(PRANA_PRICE).div(ethers.utils.parseEther("1"));
      expect(usdtAmount).to.equal(expectedUsdt);
      expect(fee).to.equal(0); // No fee initially
    });
  });

  describe("Liquidity Management", function () {
    it("Should allow owner to add liquidity", async function () {
      const { pranaExchange, pranaToken, usdtToken, owner } = await loadFixture(deployExchangeFixture);

      const additionalPrana = ethers.utils.parseEther("100000");
      const additionalUsdt = ethers.utils.parseUnits("10000", 6);

      // Transfer tokens to owner
      await pranaToken.transfer(owner.address, additionalPrana);
      await usdtToken.transfer(owner.address, additionalUsdt);

      // Approve tokens
      await pranaToken.approve(pranaExchange.address, additionalPrana);
      await usdtToken.approve(pranaExchange.address, additionalUsdt);

      // Add liquidity
      await expect(
        pranaExchange.addLiquidity(additionalPrana, additionalUsdt)
      )
        .to.emit(pranaExchange, "LiquidityAdded")
        .withArgs(owner.address, additionalPrana, additionalUsdt, await ethers.provider.getBlockNumber() + 1);

      // Check reserves
      const [pranaReserve, usdtReserve] = await pranaExchange.getReserves();
      expect(pranaReserve).to.be.gt(ethers.utils.parseEther("1000000"));
      expect(usdtReserve).to.be.gt(ethers.utils.parseUnits("100000", 6));
    });

    it("Should allow owner to remove liquidity", async function () {
      const { pranaExchange, owner } = await loadFixture(deployExchangeFixture);

      const removePrana = ethers.utils.parseEther("50000");
      const removeUsdt = ethers.utils.parseUnits("5000", 6);

      await expect(
        pranaExchange.removeLiquidity(removePrana, removeUsdt)
      )
        .to.emit(pranaExchange, "LiquidityRemoved")
        .withArgs(owner.address, removePrana, removeUsdt, await ethers.provider.getBlockNumber() + 1);
    });

    it("Should revert liquidity operations by non-owner", async function () {
      const { pranaExchange, addr1 } = await loadFixture(deployExchangeFixture);

      const amount = ethers.utils.parseEther("1000");

      await expect(
        pranaExchange.connect(addr1).addLiquidity(amount, 0)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        pranaExchange.connect(addr1).removeLiquidity(amount, 0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Fee Management", function () {
    it("Should update fees correctly", async function () {
      const { pranaExchange, owner } = await loadFixture(deployExchangeFixture);

      const newBuyFee = 50; // 0.5%
      const newSellFee = 100; // 1%

      await expect(
        pranaExchange.updateFees(newBuyFee, newSellFee)
      )
        .to.emit(pranaExchange, "FeesUpdated")
        .withArgs(newBuyFee, newSellFee);

      expect(await pranaExchange.buyFee()).to.equal(newBuyFee);
      expect(await pranaExchange.sellFee()).to.equal(newSellFee);
    });

    it("Should revert fees above maximum", async function () {
      const { pranaExchange } = await loadFixture(deployExchangeFixture);

      const excessiveFee = 600; // 6% (above 5% maximum)

      await expect(
        pranaExchange.updateFees(excessiveFee, 100)
      ).to.be.revertedWith("Exchange: buy fee too high");

      await expect(
        pranaExchange.updateFees(100, excessiveFee)
      ).to.be.revertedWith("Exchange: sell fee too high");
    });

    it("Should apply fees correctly in transactions", async function () {
      const { pranaExchange, usdtToken, pranaToken, addr1 } = await loadFixture(deployExchangeFixture);

      // Set 1% buy fee
      await pranaExchange.updateFees(100, 0);

      const usdtAmount = ethers.utils.parseUnits("100", 6);
      const expectedPranaBeforeFee = usdtAmount.mul(ethers.utils.parseEther("1")).div(PRANA_PRICE);
      const fee = expectedPranaBeforeFee.mul(100).div(10000); // 1% fee
      const expectedPranaAfterFee = expectedPranaBeforeFee.sub(fee);

      await usdtToken.connect(addr1).approve(pranaExchange.address, usdtAmount);

      await expect(
        pranaExchange.connect(addr1).buyPRANA(usdtAmount)
      )
        .to.emit(pranaExchange, "PRANAPurchased")
        .withArgs(addr1.address, usdtAmount, expectedPranaAfterFee, fee, await ethers.provider.getBlockNumber() + 1);
    });
  });

  describe("Price Oracle Integration", function () {
    it("Should return fixed price when no oracle set", async function () {
      const { pranaExchange } = await loadFixture(deployExchangeFixture);

      const currentPrice = await pranaExchange.getCurrentPrice();
      expect(currentPrice).to.equal(PRANA_PRICE);
    });

    it("Should set price oracle", async function () {
      const { pranaExchange, addr1 } = await loadFixture(deployExchangeFixture);

      await expect(
        pranaExchange.setPriceOracle(addr1.address)
      )
        .to.emit(pranaExchange, "PriceOracleUpdated")
        .withArgs(addr1.address);

      expect(await pranaExchange.priceOracle()).to.equal(addr1.address);
    });

    it("Should revert setting zero address oracle", async function () {
      const { pranaExchange } = await loadFixture(deployExchangeFixture);

      await expect(
        pranaExchange.setPriceOracle(ethers.constants.AddressZero)
      ).to.be.revertedWith("Exchange: invalid oracle address");
    });
  });

  describe("Pausing", function () {
    it("Should pause and unpause exchange operations", async function () {
      const { pranaExchange, usdtToken, addr1 } = await loadFixture(deployExchangeFixture);

      const usdtAmount = ethers.utils.parseUnits("100", 6);

      // Pause exchange
      await pranaExchange.pause();

      // Try to buy (should fail)
      await usdtToken.connect(addr1).approve(pranaExchange.address, usdtAmount);
      await expect(
        pranaExchange.connect(addr1).buyPRANA(usdtAmount)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause exchange
      await pranaExchange.unpause();

      // Buy should work now
      await pranaExchange.connect(addr1).buyPRANA(usdtAmount);
    });

    it("Should only allow owner to pause/unpause", async function () {
      const { pranaExchange, addr1 } = await loadFixture(deployExchangeFixture);

      await expect(
        pranaExchange.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        pranaExchange.connect(addr1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Emergency Functions", function () {
    it("Should handle emergency withdrawal", async function () {
      const { pranaExchange, pranaToken, owner } = await loadFixture(deployExchangeFixture);

      // Send some extra tokens to contract
      const extraAmount = ethers.utils.parseEther("1000");
      await pranaToken.transfer(pranaExchange.address, extraAmount);

      await expect(
        pranaExchange.emergencyWithdraw(pranaToken.address, extraAmount)
      ).to.emit(pranaExchange, "EmergencyWithdraw");
    });

    it("Should prevent withdrawing reserves", async function () {
      const { pranaExchange, pranaToken } = await loadFixture(deployExchangeFixture);

      const [pranaReserve] = await pranaExchange.getReserves();

      await expect(
        pranaExchange.emergencyWithdraw(pranaToken.address, pranaReserve)
      ).to.be.revertedWith("Exchange: cannot withdraw reserves");
    });

    it("Should only allow owner emergency withdrawal", async function () {
      const { pranaExchange, pranaToken, addr1 } = await loadFixture(deployExchangeFixture);

      await expect(
        pranaExchange.connect(addr1).emergencyWithdraw(pranaToken.address, 1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Statistics", function () {
    it("Should track trading volumes correctly", async function () {
      const { pranaExchange, usdtToken, pranaToken, addr1 } = await loadFixture(deployExchangeFixture);

      const buyAmount = ethers.utils.parseUnits("100", 6);
      const sellAmount = ethers.utils.parseEther("1000");

      // Buy PRANA
      await usdtToken.connect(addr1).approve(pranaExchange.address, buyAmount);
      await pranaExchange.connect(addr1).buyPRANA(buyAmount);

      // Sell PRANA
      await pranaToken.connect(addr1).approve(pranaExchange.address, sellAmount);
      await pranaExchange.connect(addr1).sellPRANA(sellAmount);

      expect(await pranaExchange.totalUSDTVolume()).to.be.gt(0);
      expect(await pranaExchange.totalPRANASold()).to.be.gt(0);
      expect(await pranaExchange.totalPRANABought()).to.be.gt(0);
    });
  });
});