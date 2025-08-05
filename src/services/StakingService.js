/**
 * Staking Service - Production Implementation
 * Handles all staking-related operations with BSC testnet integration
 */

class StakingService {
    constructor() {
        this.contractService = null;
        this.web3Service = null;
        this.isInitialized = false;
        
        // Staking constants
        this.DAILY_ROI = 120; // 1.2% (120/10000)
        this.ROI_BASE = 10000;
        this.MAX_ROI_MULTIPLE = 2; // 200%
        this.MINIMUM_STAKE = '10'; // 10 PRANA
        this.SECONDS_PER_DAY = 86400;
        
        // Referral rates (basis points)
        this.REFERRAL_RATES = [400, 200, 100, 100, 100, 100, 100, 100]; // 4%, 2%, 1%×6
    }

    /**
     * Initialize the staking service
     */
    async initialize(contractService, web3Service) {
        try {
            this.contractService = contractService;
            this.web3Service = web3Service;
            
            // Test if staking contract is available
            try {
                const stakingContract = this.contractService.getContract('pranaStaking');
                if (stakingContract) {
                    console.log('✅ Staking contract available');
                } else {
                    console.warn('⚠️ Staking contract not available');
                }
            } catch (error) {
                console.warn('⚠️ Staking contract not found:', error.message);
            }
            
            this.isInitialized = true;
            console.log('✅ StakingService initialized');
            return true;
        } catch (error) {
            console.error('❌ StakingService initialization failed:', error);
            return false;
        }
    }

    /**
     * Stake PRANA tokens
     */
    async stake(amount, referrer = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('StakingService not initialized');
            }

            // Validate amount
            if (!amount || parseFloat(amount) < parseFloat(this.MINIMUM_STAKE)) {
                throw new Error(`Minimum stake is ${this.MINIMUM_STAKE} PRANA`);
            }

            // Get current account
            const account = await this.web3Service.getCurrentAccount();
            if (!account) {
                throw new Error('No wallet connected');
            }

            // Get staking contract
            const stakingContract = this.contractService.getContract('pranaStaking');
            if (!stakingContract) {
                throw new Error('Staking contract not available');
            }

            // Convert amount to Wei
            const amountWei = this.web3Service.web3.utils.toWei(amount, 'ether');

            // First, approve PRANA tokens
            const pranaContract = this.contractService.getContract('pranaToken');
            const allowance = await pranaContract.methods.allowance(account, stakingContract.options.address).call();
            
            if (this.web3Service.web3.utils.toBN(allowance).lt(this.web3Service.web3.utils.toBN(amountWei))) {
                console.log('📝 Approving PRANA tokens...');
                const approveTx = await this.contractService.executeTransaction(
                    'pranaToken',
                    'approve',
                    [stakingContract.options.address, amountWei],
                    { from: account }
                );
                console.log('✅ PRANA tokens approved:', approveTx.transactionHash);
            }

            // Execute staking
            console.log('💰 Staking PRANA tokens...');
            const stakeTx = await this.contractService.executeTransaction(
                'pranaStaking',
                'createStake',
                [amountWei, referrer || '0x0000000000000000000000000000000000000000'],
                { from: account }
            );

            console.log('✅ Staking successful:', stakeTx.transactionHash);

            return {
                success: true,
                hash: stakeTx.transactionHash,
                amount: amount
            };

        } catch (error) {
            console.error('❌ Staking failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Regular unstake using the proper unstake method
     */
    async unstake(amount) {
        try {
            if (!this.isInitialized) {
                throw new Error('StakingService not initialized');
            }

            const account = await this.web3Service.getCurrentAccount();
            if (!account) {
                throw new Error('No wallet connected');
            }

            const stakingContract = this.contractService.getContract('pranaStaking');
            const amountWei = this.web3Service.web3.utils.toWei(amount, 'ether');

            console.log('🏦 Unstaking PRANA tokens...');
            const unstakeTx = await this.contractService.executeTransaction(
                'pranaStaking',
                'unstake',
                [amountWei],
                { from: account }
            );

            console.log('✅ Unstaking successful:', unstakeTx.transactionHash);

            return {
                success: true,
                hash: unstakeTx.transactionHash,
                amount: amount
            };

        } catch (error) {
            console.error('❌ Unstaking failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Emergency withdraw (owner only) - for contract maintenance
     */
    async emergencyWithdraw(tokenAddress, amount) {
        try {
            if (!this.isInitialized) {
                throw new Error('StakingService not initialized');
            }

            const account = await this.web3Service.getCurrentAccount();
            if (!account) {
                throw new Error('No wallet connected');
            }

            const stakingContract = this.contractService.getContract('pranaStaking');
            
            // Verify the caller is the contract owner
            const owner = await stakingContract.methods.owner().call();
            if (account.toLowerCase() !== owner.toLowerCase()) {
                throw new Error('Only contract owner can perform emergency withdrawal');
            }

            const amountWei = this.web3Service.web3.utils.toWei(amount, 'ether');

            // Check available excess balance
            const excessBalance = await stakingContract.methods.getExcessBalance(tokenAddress).call();
            if (this.web3Service.web3.utils.toBN(amountWei).gt(this.web3Service.web3.utils.toBN(excessBalance))) {
                throw new Error('Amount exceeds available excess balance');
            }

            console.log('🚨 Emergency withdrawing tokens...');
            const emergencyTx = await this.contractService.executeTransaction(
                'pranaStaking',
                'emergencyWithdraw',
                [tokenAddress, amountWei],
                { from: account }
            );

            console.log('✅ Emergency withdrawal successful:', emergencyTx.transactionHash);

            return {
                success: true,
                hash: emergencyTx.transactionHash,
                tokenAddress: tokenAddress,
                amount: amount
            };

        } catch (error) {
            console.error('❌ Emergency withdrawal failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Claim rewards
     */
    async claimRewards() {
        try {
            if (!this.isInitialized) {
                throw new Error('StakingService not initialized');
            }

            const account = await this.web3Service.getCurrentAccount();
            if (!account) {
                throw new Error('No wallet connected');
            }

            const stakingContract = this.contractService.getContract('pranaStaking');

            console.log('💎 Claiming rewards...');
            const claimTx = await this.contractService.executeTransaction(
                'pranaStaking',
                'claimRewards',
                [],
                { from: account }
            );

            console.log('✅ Rewards claimed:', claimTx.transactionHash);

            return {
                success: true,
                hash: claimTx.transactionHash
            };

        } catch (error) {
            console.error('❌ Claim rewards failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user staking information
     */
    async getUserStakingInfo(userAddress = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('StakingService not initialized');
            }

            const account = userAddress || await this.web3Service.getCurrentAccount();
            if (!account) {
                throw new Error('No account specified');
            }

            const stakingContract = this.contractService.getContract('pranaStaking');
            
            // Check if staking contract is available (not deployed on mainnet yet)
            if (!stakingContract) {
                console.warn('Staking contract not available - returning zero values');
                return {
                    success: true,
                    stakes: [],
                    totalStaked: '0',
                    availableRewards: '0',
                    stakesCount: 0
                };
            }

            // Try to get user stakes using getUserStakes method
            try {
                const userStakes = await stakingContract.methods.getUserStakes(account).call();
                const stakes = userStakes.filter(stake => stake.active).map(stake => ({
                    id: stake.id,
                    amount: this.web3Service.web3.utils.fromWei(stake.amount, 'ether'),
                    startTime: parseInt(stake.startTime),
                    lastClaimTime: parseInt(stake.lastClaimTime),
                    totalClaimed: this.web3Service.web3.utils.fromWei(stake.totalClaimed, 'ether'),
                    referrer: stake.referrer,
                    isActive: stake.active,
                    checkpointReward: this.web3Service.web3.utils.fromWei(stake.checkpointReward, 'ether')
                }));

                // Calculate total staked from active stakes
                const totalStaked = stakes.reduce((sum, stake) => sum + parseFloat(stake.amount), 0);

                return {
                    success: true,
                    stakes: stakes,
                    totalStaked: totalStaked.toString(),
                    availableRewards: '0', // Will need to calculate separately
                    stakesCount: stakes.length
                };
            } catch (error) {
                console.warn('getUserStakes method not available, using fallback approach:', error.message);
                
                // Fallback: return basic structure
                return {
                    success: true,
                    stakes: [],
                    totalStaked: '0',
                    availableRewards: '0',
                    stakesCount: 0
                };
            }

        } catch (error) {
            console.error('❌ Get user staking info failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get platform statistics
     */
    async getPlatformStats() {
        try {
            if (!this.isInitialized) {
                throw new Error('StakingService not initialized');
            }

            const stakingContract = this.contractService.getContract('pranaStaking');
            
            // Check if staking contract is available (not deployed on mainnet yet)
            if (!stakingContract) {
                console.warn('Staking contract not available - returning zero stats');
                return {
                    success: true,
                    totalStaked: '0',
                    totalRewardsPaid: '0',
                    totalReferralsPaid: '0',
                    contractBalance: '0'
                };
            }

            // Try to get contract stats, fallback to individual calls if needed
            try {
                const [totalStaked, totalRewardsPaid, totalReferralsPaid, contractBalance] = await stakingContract.methods.getContractStats().call();

                return {
                    success: true,
                    totalStaked: this.web3Service.web3.utils.fromWei(totalStaked, 'ether'),
                    totalRewardsPaid: this.web3Service.web3.utils.fromWei(totalRewardsPaid, 'ether'),
                    totalReferralsPaid: this.web3Service.web3.utils.fromWei(totalReferralsPaid, 'ether'),
                    contractBalance: this.web3Service.web3.utils.fromWei(contractBalance, 'ether')
                };
            } catch (error) {
                console.warn('getContractStats method not available, using fallback approach:', error.message);
                
                // Try individual method calls
                try {
                    const totalStaked = await stakingContract.methods.totalStaked().call();
                    const totalRewardsPaid = await stakingContract.methods.totalRewardsPaid().call();
                    const totalReferralsPaid = await stakingContract.methods.totalReferralsPaid().call();
                    
                    // Get contract balance
                    const contractBalance = await this.web3Service.web3.eth.getBalance(stakingContract.options.address);

                    return {
                        success: true,
                        totalStaked: this.web3Service.web3.utils.fromWei(totalStaked, 'ether'),
                        totalRewardsPaid: this.web3Service.web3.utils.fromWei(totalRewardsPaid, 'ether'),
                        totalReferralsPaid: this.web3Service.web3.utils.fromWei(totalReferralsPaid, 'ether'),
                        contractBalance: this.web3Service.web3.utils.fromWei(contractBalance, 'ether')
                    };
                } catch (fallbackError) {
                    console.warn('Individual method calls also failed:', fallbackError.message);
                    
                    // Return basic stats
                    return {
                        success: true,
                        totalStaked: '0',
                        totalRewardsPaid: '0',
                        totalReferralsPaid: '0',
                        contractBalance: '0'
                    };
                }
            }

        } catch (error) {
            console.error('❌ Get platform stats failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate potential rewards
     */
    calculatePotentialRewards(amount, days) {
        try {
            const dailyReward = (parseFloat(amount) * this.DAILY_ROI) / this.ROI_BASE;
            const totalRewards = dailyReward * days;
            const maxRewards = parseFloat(amount) * this.MAX_ROI_MULTIPLE;
            
            return Math.min(totalRewards, maxRewards);
        } catch (error) {
            console.error('❌ Calculate potential rewards failed:', error);
            return 0;
        }
    }

    /**
     * Get referral information
     */
    async getReferralInfo(userAddress = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('StakingService not initialized');
            }

            const account = userAddress || await this.web3Service.getCurrentAccount();
            if (!account) {
                throw new Error('No account specified');
            }

            const stakingContract = this.contractService.getContract('pranaStaking');
            
            // Check if staking contract is available (not deployed on mainnet yet)
            if (!stakingContract) {
                console.warn('Staking contract not available - returning zero referral info');
                return {
                    success: true,
                    referrer: '0x0000000000000000000000000000000000000000',
                    directCount: 0,
                    earnings: '0'
                };
            }

            // Try to get referral info using contract method
            try {
                const [referrer, directCount, earnings] = await stakingContract.methods.getReferralInfo(account).call();

                return {
                    success: true,
                    referrer: referrer,
                    directCount: parseInt(directCount),
                    earnings: this.web3Service.web3.utils.fromWei(earnings, 'ether')
                };
            } catch (error) {
                console.warn('getReferralInfo method not available, using fallback approach:', error.message);
                
                // Try individual calls or fallback
                try {
                    const referrer = await stakingContract.methods.userReferrer(account).call();
                    const referralCount = await stakingContract.methods.referralCount(account).call();
                    const totalEarnings = await stakingContract.methods.totalReferralEarnings(account).call();

                    return {
                        success: true,
                        referrer: referrer,
                        directCount: parseInt(referralCount),
                        earnings: this.web3Service.web3.utils.fromWei(totalEarnings, 'ether')
                    };
                } catch (fallbackError) {
                    console.warn('Individual referral method calls also failed:', fallbackError.message);
                    
                    // Return default structure
                    return {
                        success: true,
                        referrer: '0x0000000000000000000000000000000000000000',
                        directCount: 0,
                        earnings: '0'
                    };
                }
            }

        } catch (error) {
            console.error('❌ Get referral info failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const stakingService = new StakingService();

// Export as global
window.StakingService = StakingService;
window.stakingService = stakingService;

// ES6 module exports
export { StakingService, stakingService };