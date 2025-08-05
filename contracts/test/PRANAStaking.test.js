const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PRANAStaking", function () {
  // Constants
  const DAILY_ROI_RATE = 1200; // 1.2%
  const ROI_CAP_MULTIPLIER = 200; // 200%
  const MIN_STAKE_AMOUNT = ethers.utils.parseEther("10");
  const REFERRAL_RATES = [400, 200, 100, 100, 100, 100, 100, 100]; // Basis points

  async function deployStakingFixture() {
    const [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();

    // Deploy PRANA Token
    const PRANAToken = await ethers.getContractFactory("PRANAToken");
    const pranaToken = await PRANAToken.deploy();

    // Deploy Staking Contract
    const PRANAStaking = await ethers.getContractFactory("PRANAStaking");
    const pranaStaking = await PRANAStaking.deploy(pranaToken.address);

    // Setup tokens for testing
    const categoryId = ethers.utils.id("staking");
    const totalAllocation = ethers.utils.parseEther("10000000"); // 10M PRANA

    await pranaToken.setAllocationLimit(categoryId, totalAllocation);

    // Distribute tokens to test addresses
    const testAmount = ethers.utils.parseEther("100000");
    await pranaToken.distributeAllocation(categoryId, addr1.address, testAmount);
    await pranaToken.distributeAllocation(categoryId, addr2.address, testAmount);
    await pranaToken.distributeAllocation(categoryId, addr3.address, testAmount);
    await pranaToken.distributeAllocation(categoryId, addr4.address, testAmount);

    // Transfer rewards to staking contract
    const rewardPool = ethers.utils.parseEther("5000000"); // 5M PRANA for rewards
    await pranaToken.transfer(pranaStaking.address, rewardPool);

    return { 
      pranaToken, 
      pranaStaking, 
      owner, 
      addr1, 
      addr2, 
      addr3, 
      addr4,
      addr5,
      testAmount,
      rewardPool
    };
  }

  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      const { pranaToken, pranaStaking } = await loadFixture(deployStakingFixture);

      expect(await pranaStaking.pranaToken()).to.equal(pranaToken.address);
    });

    it("Should set correct constants", async function () {
      const { pranaStaking } = await loadFixture(deployStakingFixture);

      expect(await pranaStaking.DAILY_ROI_RATE()).to.equal(DAILY_ROI_RATE);
      expect(await pranaStaking.ROI_CAP_MULTIPLIER()).to.equal(ROI_CAP_MULTIPLIER);
      expect(await pranaStaking.MIN_STAKE_AMOUNT()).to.equal(MIN_STAKE_AMOUNT);
    });

    it("Should set correct referral rates", async function () {
      const { pranaStaking } = await loadFixture(deployStakingFixture);

      for (let i = 0; i < REFERRAL_RATES.length; i++) {
        expect(await pranaStaking.referralRates(i)).to.equal(REFERRAL_RATES[i]);
      }
    });
  });

  describe("Staking", function () {
    it("Should create a stake successfully", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Approve tokens
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);

      // Create stake
      await expect(
        pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero)
      )
        .to.emit(pranaStaking, "StakeCreated")
        .withArgs(
          addr1.address,
          0, // First stake ID
          stakeAmount,
          ethers.constants.AddressZero,
          await time.latest() + 1
        );

      // Check stake details
      const userStakes = await pranaStaking.getUserStakes(addr1.address);
      expect(userStakes.length).to.equal(1);
      expect(userStakes[0].amount).to.equal(stakeAmount);
      expect(userStakes[0].active).to.be.true;

      // Check user stats
      expect(await pranaStaking.userTotalStaked(addr1.address)).to.equal(stakeAmount);
      expect(await pranaStaking.hasStaked(addr1.address)).to.be.true;
    });

    it("Should revert stake below minimum amount", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const smallAmount = ethers.utils.parseEther("5"); // Below 10 minimum

      await pranaToken.connect(addr1).approve(pranaStaking.address, smallAmount);

      await expect(
        pranaStaking.connect(addr1).createStake(smallAmount, ethers.constants.AddressZero)
      ).to.be.revertedWith("Staking: below minimum stake");
    });

    it("Should revert self-referral", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);

      await expect(
        pranaStaking.connect(addr1).createStake(stakeAmount, addr1.address)
      ).to.be.revertedWith("Staking: cannot refer yourself");
    });

    it("Should handle multiple stakes from same user", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount1 = ethers.utils.parseEther("1000");
      const stakeAmount2 = ethers.utils.parseEther("2000");

      // First stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount1);
      await pranaStaking.connect(addr1).createStake(stakeAmount1, ethers.constants.AddressZero);

      // Second stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount2);
      await pranaStaking.connect(addr1).createStake(stakeAmount2, ethers.constants.AddressZero);

      const userStakes = await pranaStaking.getUserStakes(addr1.address);
      expect(userStakes.length).to.equal(2);
      expect(await pranaStaking.userTotalStaked(addr1.address)).to.equal(stakeAmount1.add(stakeAmount2));
    });
  });

  describe("Referral System", function () {
    it("Should set referrer for first stake", async function () {
      const { pranaToken, pranaStaking, addr1, addr2 } = await loadFixture(deployStakingFixture);

      const stakeAmount1 = ethers.utils.parseEther("1000");
      const stakeAmount2 = ethers.utils.parseEther("2000");

      // addr1 stakes first (becomes eligible referrer)
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount1);
      await pranaStaking.connect(addr1).createStake(stakeAmount1, ethers.constants.AddressZero);

      // addr2 stakes with addr1 as referrer
      await pranaToken.connect(addr2).approve(pranaStaking.address, stakeAmount2);
      await pranaStaking.connect(addr2).createStake(stakeAmount2, addr1.address);

      expect(await pranaStaking.userReferrer(addr2.address)).to.equal(addr1.address);
      expect(await pranaStaking.referralCount(addr1.address)).to.equal(1);

      const directReferrals = await pranaStaking.directReferrals(addr1.address, 0);
      expect(directReferrals).to.equal(addr2.address);
    });

    it("Should pay referral commissions", async function () {
      const { pranaToken, pranaStaking, addr1, addr2 } = await loadFixture(deployStakingFixture);

      const stakeAmount1 = ethers.utils.parseEther("1000");
      const stakeAmount2 = ethers.utils.parseEther("10000");

      // Setup referrer
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount1);
      await pranaStaking.connect(addr1).createStake(stakeAmount1, ethers.constants.AddressZero);

      const initialBalance = await pranaToken.balanceOf(addr1.address);

      // Stake with referral
      await pranaToken.connect(addr2).approve(pranaStaking.address, stakeAmount2);
      
      await expect(
        pranaStaking.connect(addr2).createStake(stakeAmount2, addr1.address)
      )
        .to.emit(pranaStaking, "ReferralCommissionPaid")
        .withArgs(
          addr1.address,
          addr2.address,
          1,
          stakeAmount2.mul(REFERRAL_RATES[0]).div(10000),
          await time.latest() + 1
        );

      const finalBalance = await pranaToken.balanceOf(addr1.address);
      const expectedCommission = stakeAmount2.mul(REFERRAL_RATES[0]).div(10000);
      
      expect(finalBalance.sub(initialBalance)).to.equal(expectedCommission);
      expect(await pranaStaking.totalReferralEarnings(addr1.address)).to.equal(expectedCommission);
    });

    it("Should handle multi-level referrals", async function () {
      const { pranaToken, pranaStaking, addr1, addr2, addr3, addr4 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create referral chain: addr1 -> addr2 -> addr3 -> addr4
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      await pranaToken.connect(addr2).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr2).createStake(stakeAmount, addr1.address);

      await pranaToken.connect(addr3).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr3).createStake(stakeAmount, addr2.address);

      const initialBalance1 = await pranaToken.balanceOf(addr1.address);
      const initialBalance2 = await pranaToken.balanceOf(addr2.address);

      // addr4 stakes with addr3 as referrer (should pay commissions to addr3, addr2, addr1)
      const largeStake = ethers.utils.parseEther("10000");
      await pranaToken.connect(addr4).approve(pranaStaking.address, largeStake);
      await pranaStaking.connect(addr4).createStake(largeStake, addr3.address);

      // Check referral earnings
      const earnings1 = await pranaStaking.totalReferralEarnings(addr1.address);
      const earnings2 = await pranaStaking.totalReferralEarnings(addr2.address);

      // addr1 should get level 3 commission (1%)
      const expectedEarnings1 = largeStake.mul(REFERRAL_RATES[2]).div(10000);
      // addr2 should get level 2 commission (2%)
      const expectedEarnings2 = largeStake.mul(REFERRAL_RATES[1]).div(10000);

      expect(earnings1).to.be.closeTo(expectedEarnings1, ethers.utils.parseEther("1"));
      expect(earnings2).to.be.closeTo(expectedEarnings2, ethers.utils.parseEther("1"));
    });

    it("Should not pay commission to ineligible referrers", async function () {
      const { pranaToken, pranaStaking, addr1, addr2 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("10000");

      // addr2 stakes with addr1 as referrer, but addr1 has no active stake
      await pranaToken.connect(addr2).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr2).createStake(stakeAmount, addr1.address);

      // addr1 should receive no commissions
      expect(await pranaStaking.totalReferralEarnings(addr1.address)).to.equal(0);
      expect(await pranaStaking.userReferrer(addr2.address)).to.equal(ethers.constants.AddressZero);
    });
  });

  describe("Rewards Calculation", function () {
    it("Should calculate rewards correctly", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Advance time by 1 day
      await time.increase(86400); // 24 hours

      const rewards = await pranaStaking.calculateRewards(addr1.address, 0);
      const expectedDailyReward = stakeAmount.mul(DAILY_ROI_RATE).div(10000);

      expect(rewards).to.be.closeTo(expectedDailyReward, ethers.utils.parseEther("1"));
    });

    it("Should respect ROI cap", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Advance time to exceed ROI cap
      const daysToExceedCap = Math.ceil((ROI_CAP_MULTIPLIER * 100) / (DAILY_ROI_RATE / 100)) + 1;
      await time.increase(daysToExceedCap * 86400);

      const rewards = await pranaStaking.calculateRewards(addr1.address, 0);
      const maxRewards = stakeAmount.mul(ROI_CAP_MULTIPLIER).div(100);

      expect(rewards).to.be.lte(maxRewards);
    });

    it("Should return zero rewards for inactive stakes", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Claim maximum rewards to deactivate stake
      const maxRewards = stakeAmount.mul(ROI_CAP_MULTIPLIER).div(100);
      const daysToExceedCap = Math.ceil((ROI_CAP_MULTIPLIER * 100) / (DAILY_ROI_RATE / 100)) + 1;
      await time.increase(daysToExceedCap * 86400);

      await pranaStaking.connect(addr1).claimRewards(0);

      // Check rewards are zero for deactivated stake
      const rewards = await pranaStaking.calculateRewards(addr1.address, 0);
      expect(rewards).to.equal(0);
    });
  });

  describe("Claiming Rewards", function () {
    it("Should claim rewards successfully", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Advance time
      await time.increase(86400); // 1 day

      const initialBalance = await pranaToken.balanceOf(addr1.address);
      const pendingRewards = await pranaStaking.calculateRewards(addr1.address, 0);

      await expect(
        pranaStaking.connect(addr1).claimRewards(0)
      )
        .to.emit(pranaStaking, "RewardsClaimed")
        .withArgs(addr1.address, 0, pendingRewards, await time.latest() + 1);

      const finalBalance = await pranaToken.balanceOf(addr1.address);
      expect(finalBalance.sub(initialBalance)).to.equal(pendingRewards);

      // Check stake was updated
      const userStakes = await pranaStaking.getUserStakes(addr1.address);
      expect(userStakes[0].totalClaimed).to.equal(pendingRewards);
    });

    it("Should revert claiming zero rewards", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Try to claim immediately (no time passed)
      await expect(
        pranaStaking.connect(addr1).claimRewards(0)
      ).to.be.revertedWith("Staking: no rewards available");
    });

    it("Should deactivate stake when ROI cap reached", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Advance time to reach ROI cap
      const daysToReachCap = Math.ceil((ROI_CAP_MULTIPLIER * 100) / (DAILY_ROI_RATE / 100));
      await time.increase(daysToReachCap * 86400);

      await expect(
        pranaStaking.connect(addr1).claimRewards(0)
      )
        .to.emit(pranaStaking, "StakeDeactivated");

      const userStakes = await pranaStaking.getUserStakes(addr1.address);
      expect(userStakes[0].active).to.be.false;
    });
  });

  describe("Restaking", function () {
    it("Should restake deactivated stake", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create and deactivate stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Reach ROI cap
      const daysToReachCap = Math.ceil((ROI_CAP_MULTIPLIER * 100) / (DAILY_ROI_RATE / 100));
      await time.increase(daysToReachCap * 86400);
      await pranaStaking.connect(addr1).claimRewards(0);

      // Restake
      await expect(
        pranaStaking.connect(addr1).restake(0)
      )
        .to.emit(pranaStaking, "RestakeExecuted");

      const userStakes = await pranaStaking.getUserStakes(addr1.address);
      expect(userStakes.length).to.equal(2); // Original + new stake
      expect(userStakes[1].active).to.be.true;
      expect(userStakes[1].amount).to.equal(stakeAmount);
    });

    it("Should revert restaking active stake", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create active stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      await expect(
        pranaStaking.connect(addr1).restake(0)
      ).to.be.revertedWith("Staking: stake still active");
    });
  });

  describe("View Functions", function () {
    it("Should return correct user statistics", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount1 = ethers.utils.parseEther("1000");
      const stakeAmount2 = ethers.utils.parseEther("2000");

      // Create multiple stakes
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount1.add(stakeAmount2));
      await pranaStaking.connect(addr1).createStake(stakeAmount1, ethers.constants.AddressZero);
      await pranaStaking.connect(addr1).createStake(stakeAmount2, ethers.constants.AddressZero);

      expect(await pranaStaking.getUserActiveStakeCount(addr1.address)).to.equal(2);
      expect(await pranaStaking.userTotalStaked(addr1.address)).to.equal(stakeAmount1.add(stakeAmount2));

      // Advance time and check total pending rewards
      await time.increase(86400);
      const totalPending = await pranaStaking.getUserTotalPendingRewards(addr1.address);
      expect(totalPending).to.be.gt(0);
    });

    it("Should return referral information", async function () {
      const { pranaToken, pranaStaking, addr1, addr2 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Setup referral
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      await pranaToken.connect(addr2).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr2).createStake(stakeAmount, addr1.address);

      const [referrer, directCount, earnings] = await pranaStaking.getReferralInfo(addr1.address);
      
      expect(referrer).to.equal(ethers.constants.AddressZero);
      expect(directCount).to.equal(1);
      expect(earnings).to.be.gt(0);
    });

    it("Should return contract statistics", async function () {
      const { pranaToken, pranaStaking, addr1, rewardPool } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      const [totalStaked, totalRewardsPaid, totalReferralsPaid, contractBalance] = 
        await pranaStaking.getContractStats();

      expect(totalStaked).to.equal(stakeAmount);
      expect(contractBalance).to.equal(rewardPool);
    });
  });

  describe("Administration", function () {
    it("Should update referral rates", async function () {
      const { pranaStaking, owner } = await loadFixture(deployStakingFixture);

      const newRates = [300, 150, 75, 75, 50, 50, 25, 25];

      await pranaStaking.updateReferralRates(newRates);

      for (let i = 0; i < newRates.length; i++) {
        expect(await pranaStaking.referralRates(i)).to.equal(newRates[i]);
      }
    });

    it("Should revert invalid referral rates", async function () {
      const { pranaStaking } = await loadFixture(deployStakingFixture);

      const invalidRates = [1100, 200, 100, 100, 100, 100, 100, 100]; // First rate > 10%

      await expect(
        pranaStaking.updateReferralRates(invalidRates)
      ).to.be.revertedWith("Staking: rate too high");
    });

    it("Should checkpoint rewards", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Create stake
      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);

      // Advance time
      await time.increase(86400);

      // Checkpoint rewards
      await pranaStaking.checkpointRewards(addr1.address, 0);

      const userStakes = await pranaStaking.getUserStakes(addr1.address);
      expect(userStakes[0].checkpointReward).to.be.gt(0);
    });

    it("Should pause and unpause contract", async function () {
      const { pranaToken, pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const stakeAmount = ethers.utils.parseEther("1000");

      // Pause contract
      await pranaStaking.pause();

      await pranaToken.connect(addr1).approve(pranaStaking.address, stakeAmount);

      await expect(
        pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause and try again
      await pranaStaking.unpause();
      await pranaStaking.connect(addr1).createStake(stakeAmount, ethers.constants.AddressZero);
    });

    it("Should handle emergency withdrawal", async function () {
      const { pranaToken, pranaStaking, owner } = await loadFixture(deployStakingFixture);

      // Add extra tokens beyond required balance
      const extraTokens = ethers.utils.parseEther("1000000");
      await pranaToken.transfer(pranaStaking.address, extraTokens);

      await expect(
        pranaStaking.emergencyWithdraw(extraTokens)
      ).to.emit(pranaStaking, "EmergencyWithdraw");
    });

    it("Should revert emergency withdrawal of required balance", async function () {
      const { pranaStaking } = await loadFixture(deployStakingFixture);

      const contractBalance = await pranaStaking.getContractStats().then(stats => stats[3]);

      await expect(
        pranaStaking.emergencyWithdraw(contractBalance)
      ).to.be.revertedWith("Staking: no excess balance");
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner for admin functions", async function () {
      const { pranaStaking, addr1 } = await loadFixture(deployStakingFixture);

      const newRates = [300, 150, 75, 75, 50, 50, 25, 25];

      await expect(
        pranaStaking.connect(addr1).updateReferralRates(newRates)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        pranaStaking.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        pranaStaking.connect(addr1).emergencyWithdraw(1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});