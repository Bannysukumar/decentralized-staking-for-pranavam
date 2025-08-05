// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PRANA Staking Contract
 * @dev Staking contract with 1.2% daily ROI, 200% cap, and 8-level referral system
 */
contract PRANAStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable pranaToken;
    
    // Staking constants
    uint256 public constant DAILY_ROI = 120; // 1.2% (120/10000)
    uint256 public constant ROI_BASE = 10000;
    uint256 public constant MAX_ROI_MULTIPLE = 2; // 200%
    uint256 public constant MINIMUM_STAKE = 10 * 10**18; // 10 PRANA
    uint256 public constant SECONDS_PER_DAY = 86400;
    
    // Referral commission rates (basis points)
    uint256[8] public referralRates = [400, 200, 100, 100, 100, 100, 100, 100]; // 4%, 2%, 1%, 1%, 1%, 1%, 1%, 1%
    
    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 totalRewards;
        uint256 claimedRewards;
        uint256 maxRewards;
        bool isActive;
    }
    
    struct ReferralInfo {
        address referrer;
        address[] referrals;
        uint256 totalCommission;
        uint256[8] levelCommissions;
    }
    
    // State variables
    mapping(address => StakeInfo[]) public userStakes;
    mapping(address => ReferralInfo) public referralInfo;
    mapping(address => bool) public hasStaked;
    
    uint256 public totalStaked;
    uint256 public totalStakers;
    uint256 public totalRewardsDistributed;
    
    // Events
    event Staked(address indexed user, uint256 amount, address indexed referrer);
    event Unstaked(address indexed user, uint256 amount, uint256 forfeitedRewards);
    event RewardsClaimed(address indexed user, uint256 amount);
    event ReferralCommissionPaid(address indexed referrer, address indexed referee, uint256 level, uint256 amount);
    
    constructor(address _pranaToken) Ownable(msg.sender) {
        require(_pranaToken != address(0), "Invalid token address");
        pranaToken = IERC20(_pranaToken);
    }
    
    /**
     * @dev Stake PRANA tokens with optional referrer
     * @dev Renamed from stake to createStake to match JavaScript implementation
     */
    function createStake(uint256 amount, address referrer) external nonReentrant whenNotPaused {
        require(amount >= MINIMUM_STAKE, "Amount below minimum stake");
        require(amount > 0, "Amount must be greater than 0");
        require(referrer != msg.sender, "Cannot refer yourself");
        
        // Transfer tokens from user
        pranaToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create stake
        StakeInfo memory newStake = StakeInfo({
            amount: amount,
            timestamp: block.timestamp,
            totalRewards: 0,
            claimedRewards: 0,
            maxRewards: amount * MAX_ROI_MULTIPLE,
            isActive: true
        });
        
        userStakes[msg.sender].push(newStake);
        
        // Update global stats
        if (!hasStaked[msg.sender]) {
            hasStaked[msg.sender] = true;
            totalStakers++;
        }
        totalStaked += amount;
        
        // Handle referral
        if (referrer != address(0) && hasStaked[referrer]) {
            _processReferral(msg.sender, referrer, amount);
        }
        
        emit Staked(msg.sender, amount, referrer);
    }
    
    /**
     * @dev Unstake PRANA tokens (forfeits unclaimed rewards)
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 totalStakedAmount = getTotalStakedAmount(msg.sender);
        require(amount <= totalStakedAmount, "Insufficient staked amount");
        
        uint256 remainingToUnstake = amount;
        uint256 totalForfeitedRewards = 0;
        
        // Process unstaking from stakes
        for (uint256 i = 0; i < userStakes[msg.sender].length && remainingToUnstake > 0; i++) {
            StakeInfo storage stakeInfo = userStakes[msg.sender][i];
            if (!stakeInfo.isActive) continue;
            
            uint256 currentRewards = _calculateCurrentRewards(stakeInfo);
            uint256 unclaimedRewards = currentRewards - stakeInfo.claimedRewards;
            
            if (stakeInfo.amount <= remainingToUnstake) {
                // Unstake entire stake
                remainingToUnstake -= stakeInfo.amount;
                totalForfeitedRewards += unclaimedRewards;
                stakeInfo.isActive = false;
            } else {
                // Partial unstake
                uint256 unstakeRatio = (remainingToUnstake * 1e18) / stakeInfo.amount;
                uint256 forfeitedRewards = (unclaimedRewards * unstakeRatio) / 1e18;
                
                stakeInfo.amount -= remainingToUnstake;
                stakeInfo.maxRewards = stakeInfo.amount * MAX_ROI_MULTIPLE;
                totalForfeitedRewards += forfeitedRewards;
                remainingToUnstake = 0;
            }
        }
        
        totalStaked -= amount;
        
        // Transfer tokens back to user
        pranaToken.safeTransfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount, totalForfeitedRewards);
    }
    
    /**
     * @dev Claim accumulated rewards
     */
    function claimRewards() external nonReentrant {
        uint256 totalClaimable = 0;
        
        for (uint256 i = 0; i < userStakes[msg.sender].length; i++) {
            StakeInfo storage stakeInfo = userStakes[msg.sender][i];
            if (!stakeInfo.isActive) continue;
            
            uint256 currentRewards = _calculateCurrentRewards(stakeInfo);
            uint256 claimableRewards = currentRewards - stakeInfo.claimedRewards;
            
            if (claimableRewards > 0) {
                stakeInfo.claimedRewards = currentRewards;
                stakeInfo.totalRewards = currentRewards;
                totalClaimable += claimableRewards;
            }
        }
        
        require(totalClaimable > 0, "No rewards available to claim");
        
        totalRewardsDistributed += totalClaimable;
        
        // Transfer rewards to user
        pranaToken.safeTransfer(msg.sender, totalClaimable);
        
        emit RewardsClaimed(msg.sender, totalClaimable);
    }
    
    /**
     * @dev Get user's total staked amount
     */
    function getTotalStakedAmount(address user) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            if (userStakes[user][i].isActive) {
                total += userStakes[user][i].amount;
            }
        }
        return total;
    }
    
    /**
     * @dev Get user's total claimable rewards
     */
    function getTotalClaimableRewards(address user) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            StakeInfo memory stakeInfo = userStakes[user][i];
            if (!stakeInfo.isActive) continue;
            
            uint256 currentRewards = _calculateCurrentRewards(stakeInfo);
            uint256 claimableRewards = currentRewards - stakeInfo.claimedRewards;
            total += claimableRewards;
        }
        return total;
    }
    
    /**
     * @dev Get user's stake count
     */
    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }
    
    /**
     * @dev Get user's stake info by index
     */
    function getUserStake(address user, uint256 index) external view returns (StakeInfo memory) {
        require(index < userStakes[user].length, "Invalid stake index");
        return userStakes[user][index];
    }
    
    /**
     * @dev Calculate current rewards for a stake
     */
    function _calculateCurrentRewards(StakeInfo memory stakeInfo) internal view returns (uint256) {
        if (!stakeInfo.isActive) return stakeInfo.totalRewards;
        
        uint256 timeElapsed = block.timestamp - stakeInfo.timestamp;
        uint256 daysElapsed = timeElapsed / SECONDS_PER_DAY;
        
        uint256 dailyReward = (stakeInfo.amount * DAILY_ROI) / ROI_BASE;
        uint256 totalRewards = dailyReward * daysElapsed;
        
        // Cap at maximum rewards
        if (totalRewards > stakeInfo.maxRewards) {
            totalRewards = stakeInfo.maxRewards;
        }
        
        return totalRewards;
    }
    
    /**
     * @dev Process referral commissions
     */
    function _processReferral(address referee, address referrer, uint256 stakeAmount) internal {
        if (referralInfo[referee].referrer == address(0)) {
            referralInfo[referee].referrer = referrer;
            referralInfo[referrer].referrals.push(referee);
        }
        
        address currentReferrer = referrer;
        
        for (uint256 level = 0; level < 8 && currentReferrer != address(0); level++) {
            if (!hasStaked[currentReferrer]) break;
            
            uint256 commission = (stakeAmount * referralRates[level]) / ROI_BASE;
            
            referralInfo[currentReferrer].totalCommission += commission;
            referralInfo[currentReferrer].levelCommissions[level] += commission;
            
            // Transfer commission
            pranaToken.safeTransfer(currentReferrer, commission);
            
            emit ReferralCommissionPaid(currentReferrer, referee, level + 1, commission);
            
            // Move to next level
            currentReferrer = referralInfo[currentReferrer].referrer;
        }
    }
    
    /**
     * @dev Get referral chain for a user
     */
    function getReferralChain(address user) external view returns (address[] memory) {
        address[] memory chain = new address[](8);
        address currentReferrer = referralInfo[user].referrer;
        
        for (uint256 i = 0; i < 8 && currentReferrer != address(0); i++) {
            chain[i] = currentReferrer;
            currentReferrer = referralInfo[currentReferrer].referrer;
        }
        
        return chain;
    }
    
    /**
     * @dev Get user stakes array (JavaScript expects this function)
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }
    
    /**
     * @dev Get contract statistics (JavaScript expects this function)
     */
    function getContractStats() external view returns (uint256, uint256, uint256, uint256) {
        // Calculate total referral commissions
        uint256 totalReferralsPaid = 0;
        // Note: This is expensive to calculate on-chain, consider caching
        
        return (
            totalStaked,
            totalRewardsDistributed,
            totalReferralsPaid,
            pranaToken.balanceOf(address(this))
        );
    }
    
    /**
     * @dev Get referral information (JavaScript expects this function)
     */
    function getReferralInfo(address user) external view returns (address, uint256, uint256) {
        ReferralInfo memory info = referralInfo[user];
        return (
            info.referrer,
            info.referrals.length,
            info.totalCommission
        );
    }
    
    /**
     * @dev Get user's active stake count
     */
    function getUserActiveStakeCount(address user) external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            if (userStakes[user][i].isActive) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Get user's total pending rewards
     */
    function getUserTotalPendingRewards(address user) external view returns (uint256) {
        return getTotalClaimableRewards(user);
    }
    
    /**
     * @dev Calculate rewards for a specific stake
     */
    function calculateRewards(address user, uint256 stakeIndex) external view returns (uint256) {
        require(stakeIndex < userStakes[user].length, "Invalid stake index");
        StakeInfo memory stakeInfo = userStakes[user][stakeIndex];
        return _calculateCurrentRewards(stakeInfo);
    }
    
    /**
     * @dev Owner functions
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Emergency withdrawal events
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed recipient);
    
    /**
     * @dev Emergency withdrawal (owner only) with enhanced security
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        // If withdrawing PRANA token, ensure we don't withdraw user staked funds
        if (token == address(pranaToken)) {
            uint256 contractBalance = pranaToken.balanceOf(address(this));
            uint256 excessBalance = contractBalance > totalStaked ? contractBalance - totalStaked : 0;
            require(amount <= excessBalance, "Cannot withdraw user staked funds");
        }
        
        IERC20(token).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(token, amount, owner());
    }
    
    /**
     * @dev Get excess token balance available for emergency withdrawal
     */
    function getExcessBalance(address token) external view returns (uint256) {
        if (token == address(pranaToken)) {
            uint256 contractBalance = pranaToken.balanceOf(address(this));
            return contractBalance > totalStaked ? contractBalance - totalStaked : 0;
        }
        return IERC20(token).balanceOf(address(this));
    }
}