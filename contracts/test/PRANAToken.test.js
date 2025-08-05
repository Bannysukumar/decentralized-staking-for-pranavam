const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PRANAToken", function () {
  // Constants
  const TOTAL_SUPPLY = ethers.utils.parseEther("21000000000"); // 21 billion
  const MAX_TRANSFER_PERCENT = 1; // 1%
  const MAX_WALLET_PERCENT = 3; // 3%

  async function deployTokenFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const PRANAToken = await ethers.getContractFactory("PRANAToken");
    const pranaToken = await PRANAToken.deploy();

    return { pranaToken, owner, addr1, addr2, addr3 };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { pranaToken } = await loadFixture(deployTokenFixture);

      expect(await pranaToken.name()).to.equal("PRANA");
      expect(await pranaToken.symbol()).to.equal("PRANA");
    });

    it("Should set the correct decimals", async function () {
      const { pranaToken } = await loadFixture(deployTokenFixture);

      expect(await pranaToken.decimals()).to.equal(18);
    });

    it("Should mint total supply to contract", async function () {
      const { pranaToken } = await loadFixture(deployTokenFixture);

      const contractBalance = await pranaToken.balanceOf(pranaToken.address);
      expect(contractBalance).to.equal(TOTAL_SUPPLY);
    });

    it("Should set correct anti-whale limits", async function () {
      const { pranaToken } = await loadFixture(deployTokenFixture);

      const maxTransfer = await pranaToken.maxTransferAmount();
      const maxWallet = await pranaToken.maxWalletAmount();

      const expectedMaxTransfer = TOTAL_SUPPLY.mul(MAX_TRANSFER_PERCENT).div(100);
      const expectedMaxWallet = TOTAL_SUPPLY.mul(MAX_WALLET_PERCENT).div(100);

      expect(maxTransfer).to.equal(expectedMaxTransfer);
      expect(maxWallet).to.equal(expectedMaxWallet);
    });

    it("Should exclude owner and contract from limits", async function () {
      const { pranaToken, owner } = await loadFixture(deployTokenFixture);

      expect(await pranaToken.isExcludedFromLimits(owner.address)).to.be.true;
      expect(await pranaToken.isExcludedFromLimits(pranaToken.address)).to.be.true;
    });
  });

  describe("Allocation Management", function () {
    it("Should set allocation limits", async function () {
      const { pranaToken, owner } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("presale");
      const limit = ethers.utils.parseEther("1000000");

      await pranaToken.setAllocationLimit(categoryId, limit);

      expect(await pranaToken.allocationLimits(categoryId)).to.equal(limit);
    });

    it("Should revert setting zero allocation limit", async function () {
      const { pranaToken } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("presale");

      await expect(
        pranaToken.setAllocationLimit(categoryId, 0)
      ).to.be.revertedWith("PRANA: invalid limit");
    });

    it("Should distribute allocation correctly", async function () {
      const { pranaToken, owner, addr1 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("presale");
      const limit = ethers.utils.parseEther("1000000");
      const amount = ethers.utils.parseEther("500000");

      await pranaToken.setAllocationLimit(categoryId, limit);
      
      await expect(
        pranaToken.distributeAllocation(categoryId, addr1.address, amount)
      )
        .to.emit(pranaToken, "AllocationDistributed")
        .withArgs(categoryId, addr1.address, amount);

      expect(await pranaToken.balanceOf(addr1.address)).to.equal(amount);
      expect(await pranaToken.allocationClaimed(addr1.address)).to.equal(amount);
    });

    it("Should revert distribution if exceeds limit", async function () {
      const { pranaToken, addr1 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("presale");
      const limit = ethers.utils.parseEther("1000000");
      const amount = ethers.utils.parseEther("1500000");

      await pranaToken.setAllocationLimit(categoryId, limit);

      await expect(
        pranaToken.distributeAllocation(categoryId, addr1.address, amount)
      ).to.be.revertedWith("PRANA: allocation limit exceeded");
    });

    it("Should handle batch distribution", async function () {
      const { pranaToken, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("airdrop");
      const limit = ethers.utils.parseEther("2000000");
      const amount1 = ethers.utils.parseEther("500000");
      const amount2 = ethers.utils.parseEther("300000");

      await pranaToken.setAllocationLimit(categoryId, limit);

      await pranaToken.batchDistribute(
        categoryId,
        [addr1.address, addr2.address],
        [amount1, amount2]
      );

      expect(await pranaToken.balanceOf(addr1.address)).to.equal(amount1);
      expect(await pranaToken.balanceOf(addr2.address)).to.equal(amount2);
    });

    it("Should revert batch distribution with mismatched arrays", async function () {
      const { pranaToken, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("airdrop");
      const amount = ethers.utils.parseEther("500000");

      await expect(
        pranaToken.batchDistribute(
          categoryId,
          [addr1.address, addr2.address],
          [amount] // Mismatched length
        )
      ).to.be.revertedWith("PRANA: length mismatch");
    });
  });

  describe("Anti-whale Protection", function () {
    it("Should enforce transfer limits", async function () {
      const { pranaToken, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("test");
      const allocation = ethers.utils.parseEther("1000000");
      const maxTransfer = await pranaToken.maxTransferAmount();

      // Setup allocation and distribute
      await pranaToken.setAllocationLimit(categoryId, allocation);
      await pranaToken.distributeAllocation(categoryId, addr1.address, allocation);

      // Try to transfer more than limit
      const excessiveAmount = maxTransfer.add(1);

      await expect(
        pranaToken.connect(addr1).transfer(addr2.address, excessiveAmount)
      ).to.be.revertedWith("PRANA: transfer amount exceeds limit");
    });

    it("Should enforce wallet limits", async function () {
      const { pranaToken, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("test");
      const allocation = ethers.utils.parseEther("2000000");
      const maxWallet = await pranaToken.maxWalletAmount();

      // Setup allocation and distribute to addr1
      await pranaToken.setAllocationLimit(categoryId, allocation);
      await pranaToken.distributeAllocation(categoryId, addr1.address, allocation);

      // Try to send tokens that would exceed wallet limit
      const amount = maxWallet.add(1);

      await expect(
        pranaToken.connect(addr1).transfer(addr2.address, amount)
      ).to.be.revertedWith("PRANA: wallet limit exceeded");
    });

    it("Should allow transfers for excluded addresses", async function () {
      const { pranaToken, owner, addr1 } = await loadFixture(deployTokenFixture);

      const maxTransfer = await pranaToken.maxTransferAmount();
      const excessiveAmount = maxTransfer.mul(2);

      // Owner is excluded by default
      await pranaToken.transfer(addr1.address, excessiveAmount);

      expect(await pranaToken.balanceOf(addr1.address)).to.equal(excessiveAmount);
    });

    it("Should update limits correctly", async function () {
      const { pranaToken } = await loadFixture(deployTokenFixture);

      const newMaxTransfer = ethers.utils.parseEther("500000000"); // 500M
      const newMaxWallet = ethers.utils.parseEther("1000000000"); // 1B

      await expect(
        pranaToken.updateLimits(newMaxTransfer, newMaxWallet)
      )
        .to.emit(pranaToken, "MaxLimitsUpdated")
        .withArgs(newMaxTransfer, newMaxWallet);

      expect(await pranaToken.maxTransferAmount()).to.equal(newMaxTransfer);
      expect(await pranaToken.maxWalletAmount()).to.equal(newMaxWallet);
    });

    it("Should revert invalid limit updates", async function () {
      const { pranaToken } = await loadFixture(deployTokenFixture);

      const tooLowTransfer = ethers.utils.parseEther("1000000"); // Less than 0.1%
      const normalWallet = ethers.utils.parseEther("500000000");

      await expect(
        pranaToken.updateLimits(tooLowTransfer, normalWallet)
      ).to.be.revertedWith("PRANA: transfer limit too low");
    });

    it("Should exclude/include addresses from limits", async function () {
      const { pranaToken, addr1 } = await loadFixture(deployTokenFixture);

      await expect(
        pranaToken.setExcludedFromLimits(addr1.address, true)
      )
        .to.emit(pranaToken, "AddressExcludedFromLimits")
        .withArgs(addr1.address, true);

      expect(await pranaToken.isExcludedFromLimits(addr1.address)).to.be.true;

      await pranaToken.setExcludedFromLimits(addr1.address, false);
      expect(await pranaToken.isExcludedFromLimits(addr1.address)).to.be.false;
    });
  });

  describe("Burning", function () {
    it("Should burn tokens with reason", async function () {
      const { pranaToken, addr1 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("test");
      const allocation = ethers.utils.parseEther("1000000");
      const burnAmount = ethers.utils.parseEther("100000");

      // Setup and distribute tokens
      await pranaToken.setAllocationLimit(categoryId, allocation);
      await pranaToken.distributeAllocation(categoryId, addr1.address, allocation);

      const initialSupply = await pranaToken.totalSupply();

      await expect(
        pranaToken.connect(addr1).burnWithReason(burnAmount, "Deflationary burn")
      )
        .to.emit(pranaToken, "BurnExecuted")
        .withArgs(burnAmount, "Deflationary burn");

      expect(await pranaToken.totalSupply()).to.equal(initialSupply.sub(burnAmount));
      expect(await pranaToken.balanceOf(addr1.address)).to.equal(allocation.sub(burnAmount));
    });
  });

  describe("Pausing", function () {
    it("Should pause and unpause transfers", async function () {
      const { pranaToken, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const amount = ethers.utils.parseEther("1000");

      // Distribute some tokens first
      const categoryId = ethers.utils.id("test");
      await pranaToken.setAllocationLimit(categoryId, amount.mul(2));
      await pranaToken.distributeAllocation(categoryId, addr1.address, amount);

      // Pause contract
      await pranaToken.pause();

      // Try to transfer (should fail)
      await expect(
        pranaToken.connect(addr1).transfer(addr2.address, amount)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause contract
      await pranaToken.unpause();

      // Transfer should work now
      await pranaToken.connect(addr1).transfer(addr2.address, amount);
      expect(await pranaToken.balanceOf(addr2.address)).to.equal(amount);
    });

    it("Should only allow owner to pause/unpause", async function () {
      const { pranaToken, addr1 } = await loadFixture(deployTokenFixture);

      await expect(
        pranaToken.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        pranaToken.connect(addr1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Emergency Functions", function () {
    it("Should handle emergency withdrawal of ETH", async function () {
      const { pranaToken, owner } = await loadFixture(deployTokenFixture);

      // Send some ETH to contract
      await owner.sendTransaction({
        to: pranaToken.address,
        value: ethers.utils.parseEther("1")
      });

      const initialBalance = await owner.getBalance();

      await expect(
        pranaToken.emergencyWithdraw(
          ethers.constants.AddressZero,
          owner.address,
          ethers.utils.parseEther("1")
        )
      ).to.emit(pranaToken, "EmergencyWithdraw");
    });

    it("Should handle emergency withdrawal of tokens", async function () {
      const { pranaToken, owner } = await loadFixture(deployTokenFixture);

      const withdrawAmount = ethers.utils.parseEther("1000000");

      await expect(
        pranaToken.emergencyWithdraw(
          pranaToken.address,
          owner.address,
          withdrawAmount
        )
      ).to.emit(pranaToken, "EmergencyWithdraw");

      expect(await pranaToken.balanceOf(owner.address)).to.equal(withdrawAmount);
    });

    it("Should revert emergency withdrawal by non-owner", async function () {
      const { pranaToken, addr1 } = await loadFixture(deployTokenFixture);

      await expect(
        pranaToken.connect(addr1).emergencyWithdraw(
          ethers.constants.AddressZero,
          addr1.address,
          ethers.utils.parseEther("1")
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    it("Should return correct circulating supply", async function () {
      const { pranaToken, addr1 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("test");
      const allocation = ethers.utils.parseEther("1000000");

      await pranaToken.setAllocationLimit(categoryId, allocation);
      await pranaToken.distributeAllocation(categoryId, addr1.address, allocation);

      const circulatingSupply = await pranaToken.circulatingSupply();
      expect(circulatingSupply).to.equal(allocation);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to call owner functions", async function () {
      const { pranaToken, addr1 } = await loadFixture(deployTokenFixture);

      const categoryId = ethers.utils.id("test");
      const amount = ethers.utils.parseEther("1000");

      await expect(
        pranaToken.connect(addr1).setAllocationLimit(categoryId, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        pranaToken.connect(addr1).distributeAllocation(categoryId, addr1.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        pranaToken.connect(addr1).updateLimits(amount, amount.mul(2))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});