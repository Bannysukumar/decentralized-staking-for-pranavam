const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Pranavam Platform Integration", function () {
  
  async function deployPlatformFixture() {
    const [owner, user1, user2, user3, treasury] = await ethers.getSigners();

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

    // Deploy Staking
    const PRANAStaking = await ethers.getContractFactory("PRANAStaking");
    const pranaStaking = await PRANAStaking.deploy(pranaToken.address);

    // Setup token allocations
    const categoryExchange = ethers.utils.id("exchange");
    const categoryStaking = ethers.utils.id("staking");
    const categoryUsers = ethers.utils.id("users");

    const exchangeAllocation = ethers.utils.parseEther("5000000000"); // 5B for exchange
    const stakingAllocation = ethers.utils.parseEther("10000000000"); // 10B for staking
    const userAllocation = ethers.utils.parseEther("1000000000"); // 1B for users

    await pranaToken.setAllocationLimit(categoryExchange, exchangeAllocation);
    await pranaToken.setAllocationLimit(categoryStaking, stakingAllocation);
    await pranaToken.setAllocationLimit(categoryUsers, userAllocation);

    // Distribute tokens
    await pranaToken.distributeAllocation(categoryExchange, pranaExchange.address, exchangeAllocation);
    await pranaToken.distributeAllocation(categoryStaking, pranaStaking.address, stakingAllocation);

    // Give users some tokens for testing
    const userTokens = ethers.utils.parseEther("100000");
    await pranaToken.distributeAllocation(categoryUsers, user1.address, userTokens);
    await pranaToken.distributeAllocation(categoryUsers, user2.address, userTokens);
    await pranaToken.distributeAllocation(categoryUsers, user3.address, userTokens);

    // Setup USDT for users
    const userUsdt = ethers.utils.parseUnits("10000", 6);
    await usdtToken.transfer(user1.address, userUsdt);
    await usdtToken.transfer(user2.address, userUsdt);
    await usdtToken.transfer(user3.address, userUsdt);

    // Setup initial exchange liquidity
    const usdtLiquidity = ethers.utils.parseUnits("1000000", 6); // 1M USDT
    await usdtToken.transfer(owner.address, usdtLiquidity);
    await usdtToken.approve(pranaExchange.address, usdtLiquidity);
    await pranaExchange.addLiquidity(0, usdtLiquidity);

    return {
      pranaToken,
      usdtToken,
      pranaExchange,
      pranaStaking,
      owner,
      user1,
      user2,
      user3,
      treasury,
      userTokens,
      userUsdt
    };
  }

  describe("Complete User Journey", function () {
    it("Should handle complete user flow: buy -> stake -> refer -> claim -> sell", async function () {
      const { 
        pranaToken, 
        usdtToken, 
        pranaExchange, 
        pranaStaking, 
        user1, 
        user2,
        userUsdt
      } = await loadFixture(deployPlatformFixture);

      // ===== STEP 1: User1 buys PRANA =====
      const buyAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDT
      
      await usdtToken.connect(user1).approve(pranaExchange.address, buyAmount);
      const buyTx = await pranaExchange.connect(user1).buyPRANA(buyAmount);
      
      const buyReceipt = await buyTx.wait();
      const purchaseEvent = buyReceipt.events.find(e => e.event === "PRANAPurchased");
      const pranaBought = purchaseEvent.args.pranaAmount;

      console.log(`User1 bought ${ethers.utils.formatEther(pranaBought)} PRANA with ${ethers.utils.formatUnits(buyAmount, 6)} USDT`);

      // ===== STEP 2: User1 stakes PRANA =====
      const stakeAmount = pranaBought.div(2); // Stake half
      
      await pranaToken.connect(user1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(user1).createStake(stakeAmount, ethers.constants.AddressZero);

      console.log(`User1 staked ${ethers.utils.formatEther(stakeAmount)} PRANA`);

      // ===== STEP 3: User2 buys and stakes with User1 as referrer =====
      await usdtToken.connect(user2).approve(pranaExchange.address, buyAmount);
      const user2PranaBought = (await pranaExchange.connect(user2).callStatic.buyPRANA(buyAmount));
      await pranaExchange.connect(user2).buyPRANA(buyAmount);

      await pranaToken.connect(user2).approve(pranaStaking.address, user2PranaBought);
      await pranaStaking.connect(user2).createStake(user2PranaBought, user1.address);

      console.log(`User2 staked ${ethers.utils.formatEther(user2PranaBought)} PRANA with User1 as referrer`);

      // Check referral setup
      expect(await pranaStaking.userReferrer(user2.address)).to.equal(user1.address);
      expect(await pranaStaking.referralCount(user1.address)).to.equal(1);

      // ===== STEP 4: Wait and accumulate rewards =====
      await time.increase(86400 * 7); // 7 days

      const user1Rewards = await pranaStaking.calculateRewards(user1.address, 0);
      const user2Rewards = await pranaStaking.calculateRewards(user2.address, 0);

      console.log(`After 7 days:`);
      console.log(`User1 pending rewards: ${ethers.utils.formatEther(user1Rewards)} PRANA`);
      console.log(`User2 pending rewards: ${ethers.utils.formatEther(user2Rewards)} PRANA`);

      expect(user1Rewards).to.be.gt(0);
      expect(user2Rewards).to.be.gt(0);

      // ===== STEP 5: Claim rewards =====
      const user1BalanceBefore = await pranaToken.balanceOf(user1.address);
      await pranaStaking.connect(user1).claimRewards(0);
      const user1BalanceAfter = await pranaToken.balanceOf(user1.address);

      const actualRewardsClaimed = user1BalanceAfter.sub(user1BalanceBefore);
      console.log(`User1 claimed ${ethers.utils.formatEther(actualRewardsClaimed)} PRANA rewards`);

      expect(actualRewardsClaimed).to.be.closeTo(user1Rewards, ethers.utils.parseEther("1"));

      // Check referral earnings
      const user1ReferralEarnings = await pranaStaking.totalReferralEarnings(user1.address);
      console.log(`User1 referral earnings: ${ethers.utils.formatEther(user1ReferralEarnings)} PRANA`);
      expect(user1ReferralEarnings).to.be.gt(0);

      // ===== STEP 6: User1 sells some PRANA =====
      const sellAmount = ethers.utils.parseEther("5000"); // Sell 5000 PRANA
      const user1PranaBalance = await pranaToken.balanceOf(user1.address);
      
      if (user1PranaBalance.gte(sellAmount)) {
        await pranaToken.connect(user1).approve(pranaExchange.address, sellAmount);
        const sellTx = await pranaExchange.connect(user1).sellPRANA(sellAmount);
        
        const sellReceipt = await sellTx.wait();
        const sellEvent = sellReceipt.events.find(e => e.event === "PRANASold");
        const usdtReceived = sellEvent.args.usdtAmount;

        console.log(`User1 sold ${ethers.utils.formatEther(sellAmount)} PRANA for ${ethers.utils.formatUnits(usdtReceived, 6)} USDT`);
      }

      // ===== STEP 7: Verify final state =====
      const finalStats = await pranaStaking.getContractStats();
      console.log(`\nFinal Platform Stats:`);
      console.log(`Total Staked: ${ethers.utils.formatEther(finalStats[0])} PRANA`);
      console.log(`Total Rewards Paid: ${ethers.utils.formatEther(finalStats[1])} PRANA`);
      console.log(`Total Referrals Paid: ${ethers.utils.formatEther(finalStats[2])} PRANA`);

      const [pranaReserve, usdtReserve] = await pranaExchange.getReserves();
      console.log(`Exchange Reserves: ${ethers.utils.formatEther(pranaReserve)} PRANA, ${ethers.utils.formatUnits(usdtReserve, 6)} USDT`);

      // Verify platform integrity
      expect(finalStats[0]).to.be.gt(0); // Total staked
      expect(finalStats[1]).to.be.gt(0); // Rewards paid
      expect(finalStats[2]).to.be.gt(0); // Referrals paid
    });
  });

  describe("Zero Token Loss Scenarios", function () {
    it("Should handle failed transactions without token loss", async function () {
      const { pranaToken, pranaExchange, user1 } = await loadFixture(deployPlatformFixture);

      const initialBalance = await pranaToken.balanceOf(user1.address);

      // Try to buy with insufficient USDT approval (should fail)
      await expect(
        pranaExchange.connect(user1).buyPRANA(ethers.utils.parseUnits("1000", 6))
      ).to.be.reverted;

      // Verify no tokens were lost
      const finalBalance = await pranaToken.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance);
    });

    it("Should handle staking edge cases without token loss", async function () {
      const { pranaToken, pranaStaking, user1 } = await loadFixture(deployPlatformFixture);

      const initialBalance = await pranaToken.balanceOf(user1.address);

      // Try to stake without approval (should fail)
      await expect(
        pranaStaking.connect(user1).createStake(ethers.utils.parseEther("1000"), ethers.constants.AddressZero)
      ).to.be.reverted;

      // Verify no tokens were lost
      const finalBalance = await pranaToken.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance);
    });

    it("Should handle exchange edge cases without token loss", async function () {
      const { pranaToken, pranaExchange, user1 } = await loadFixture(deployPlatformFixture);

      const initialBalance = await pranaToken.balanceOf(user1.address);

      // Try to sell without approval (should fail)
      await expect(
        pranaExchange.connect(user1).sellPRANA(ethers.utils.parseEther("1000"))
      ).to.be.reverted;

      // Verify no tokens were lost
      const finalBalance = await pranaToken.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance);
    });
  });

  describe("Multi-User Interaction Scenarios", function () {
    it("Should handle multiple users trading simultaneously", async function () {
      const { 
        pranaToken, 
        usdtToken, 
        pranaExchange, 
        user1, 
        user2, 
        user3 
      } = await loadFixture(deployPlatformFixture);

      const buyAmount = ethers.utils.parseUnits("500", 6);

      // Multiple users buy simultaneously
      await usdtToken.connect(user1).approve(pranaExchange.address, buyAmount);
      await usdtToken.connect(user2).approve(pranaExchange.address, buyAmount);
      await usdtToken.connect(user3).approve(pranaExchange.address, buyAmount);

      const promises = [
        pranaExchange.connect(user1).buyPRANA(buyAmount),
        pranaExchange.connect(user2).buyPRANA(buyAmount),
        pranaExchange.connect(user3).buyPRANA(buyAmount)
      ];

      await Promise.all(promises);

      // Verify all users received tokens
      const user1Balance = await pranaToken.balanceOf(user1.address);
      const user2Balance = await pranaToken.balanceOf(user2.address);
      const user3Balance = await pranaToken.balanceOf(user3.address);

      expect(user1Balance).to.be.gt(ethers.utils.parseEther("100000")); // Initial + bought
      expect(user2Balance).to.be.gt(ethers.utils.parseEther("100000"));
      expect(user3Balance).to.be.gt(ethers.utils.parseEther("100000"));
    });

    it("Should handle complex referral chains", async function () {
      const { 
        pranaToken, 
        pranaStaking, 
        user1, 
        user2, 
        user3 
      } = await loadFixture(deployPlatformFixture);

      const stakeAmount = ethers.utils.parseEther("10000");

      // Create referral chain: user1 -> user2 -> user3
      await pranaToken.connect(user1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(user1).createStake(stakeAmount, ethers.constants.AddressZero);

      await pranaToken.connect(user2).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(user2).createStake(stakeAmount, user1.address);

      await pranaToken.connect(user3).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(user3).createStake(stakeAmount, user2.address);

      // Verify referral chain
      expect(await pranaStaking.userReferrer(user2.address)).to.equal(user1.address);
      expect(await pranaStaking.userReferrer(user3.address)).to.equal(user2.address);

      // Check referral earnings
      const user1Earnings = await pranaStaking.totalReferralEarnings(user1.address);
      const user2Earnings = await pranaStaking.totalReferralEarnings(user2.address);

      expect(user1Earnings).to.be.gt(0); // Level 2 commission from user3
      expect(user2Earnings).to.be.gt(0); // Level 1 commission from user3
    });
  });

  describe("Emergency Scenarios", function () {
    it("Should handle contract pausing correctly", async function () {
      const { 
        pranaToken, 
        usdtToken, 
        pranaExchange, 
        pranaStaking, 
        user1,
        owner 
      } = await loadFixture(deployPlatformFixture);

      // Pause all contracts
      await pranaExchange.pause();
      await pranaStaking.pause();

      const buyAmount = ethers.utils.parseUnits("100", 6);
      const stakeAmount = ethers.utils.parseEther("1000");

      // Try operations (should fail)
      await usdtToken.connect(user1).approve(pranaExchange.address, buyAmount);
      await expect(
        pranaExchange.connect(user1).buyPRANA(buyAmount)
      ).to.be.revertedWith("Pausable: paused");

      await pranaToken.connect(user1).approve(pranaStaking.address, stakeAmount);
      await expect(
        pranaStaking.connect(user1).createStake(stakeAmount, ethers.constants.AddressZero)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause and verify operations work
      await pranaExchange.unpause();
      await pranaStaking.unpause();

      await pranaExchange.connect(user1).buyPRANA(buyAmount);
      await pranaStaking.connect(user1).createStake(stakeAmount, ethers.constants.AddressZero);
    });

    it("Should handle emergency withdrawals correctly", async function () {
      const { 
        pranaToken, 
        pranaExchange, 
        pranaStaking, 
        owner 
      } = await loadFixture(deployPlatformFixture);

      // Add extra tokens for emergency withdrawal
      const extraTokens = ethers.utils.parseEther("1000000");
      await pranaToken.transfer(pranaStaking.address, extraTokens);

      const ownerBalanceBefore = await pranaToken.balanceOf(owner.address);

      // Emergency withdraw from staking
      await pranaStaking.emergencyWithdraw(extraTokens);

      const ownerBalanceAfter = await pranaToken.balanceOf(owner.address);
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(extraTokens);
    });
  });

  describe("Long-term Scenario Testing", function () {
    it("Should handle long-term staking and compound growth", async function () {
      const { 
        pranaToken, 
        pranaStaking, 
        user1 
      } = await loadFixture(deployPlatformFixture);

      const initialStake = ethers.utils.parseEther("10000");

      // Create initial stake
      await pranaToken.connect(user1).approve(pranaStaking.address, initialStake);
      await pranaStaking.connect(user1).createStake(initialStake, ethers.constants.AddressZero);

      // Track rewards over multiple periods
      const periods = [1, 7, 30, 90]; // days
      const rewardsHistory = [];

      for (const period of periods) {
        await time.increase(86400 * (period - (rewardsHistory.length > 0 ? periods[rewardsHistory.length - 1] : 0)));
        
        const rewards = await pranaStaking.calculateRewards(user1.address, 0);
        rewardsHistory.push({
          day: period,
          rewards: ethers.utils.formatEther(rewards)
        });

        console.log(`Day ${period}: ${ethers.utils.formatEther(rewards)} PRANA rewards`);
      }

      // Verify rewards are increasing over time
      for (let i = 1; i < rewardsHistory.length; i++) {
        expect(parseFloat(rewardsHistory[i].rewards)).to.be.gt(parseFloat(rewardsHistory[i-1].rewards));
      }

      // Test reaching ROI cap
      const roiCapDays = Math.ceil(200 / 1.2); // 200% cap / 1.2% daily
      await time.increase(86400 * roiCapDays);

      const finalRewards = await pranaStaking.calculateRewards(user1.address, 0);
      const maxRewards = initialStake.mul(200).div(100); // 200% of initial stake

      expect(finalRewards).to.be.lte(maxRewards);
    });
  });

  describe("Gas Usage Optimization", function () {
    it("Should maintain reasonable gas costs for common operations", async function () {
      const { 
        pranaToken, 
        usdtToken, 
        pranaExchange, 
        pranaStaking, 
        user1 
      } = await loadFixture(deployPlatformFixture);

      // Test gas usage for common operations
      const buyAmount = ethers.utils.parseUnits("100", 6);
      await usdtToken.connect(user1).approve(pranaExchange.address, buyAmount);
      
      const buyTx = await pranaExchange.connect(user1).buyPRANA(buyAmount);
      const buyReceipt = await buyTx.wait();
      console.log(`Buy PRANA gas used: ${buyReceipt.gasUsed.toString()}`);

      const stakeAmount = ethers.utils.parseEther("1000");
      await pranaToken.connect(user1).approve(pranaStaking.address, stakeAmount);
      
      const stakeTx = await pranaStaking.connect(user1).createStake(stakeAmount, ethers.constants.AddressZero);
      const stakeReceipt = await stakeTx.wait();
      console.log(`Create stake gas used: ${stakeReceipt.gasUsed.toString()}`);

      // Wait and claim rewards
      await time.increase(86400);
      
      const claimTx = await pranaStaking.connect(user1).claimRewards(0);
      const claimReceipt = await claimTx.wait();
      console.log(`Claim rewards gas used: ${claimReceipt.gasUsed.toString()}`);

      // Verify gas usage is reasonable (adjust limits as needed)
      expect(buyReceipt.gasUsed).to.be.lt(150000);
      expect(stakeReceipt.gasUsed).to.be.lt(200000);
      expect(claimReceipt.gasUsed).to.be.lt(100000);
    });
  });
});