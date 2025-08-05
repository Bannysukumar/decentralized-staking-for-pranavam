// Contract type definitions following TDD requirements

export interface PRANATokenContract {
  totalSupply(): Promise<string>;
  balanceOf(address: string): Promise<string>;
  transfer(to: string, amount: string): Promise<any>;
  approve(spender: string, amount: string): Promise<any>;
  allowance(owner: string, spender: string): Promise<string>;
  decimals(): Promise<number>;
  symbol(): Promise<string>;
  name(): Promise<string>;
}

export interface StakingContract {
  stake(amount: string, referrer?: string): Promise<any>;
  unstake(amount: string): Promise<any>;
  claimRewards(): Promise<any>;
  getStakeInfo(address: string): Promise<StakeInfo>;
  calculateRewards(address: string): Promise<string>;
  getTotalStaked(): Promise<string>;
  getStakerCount(): Promise<number>;
  getReferralInfo(address: string): Promise<ReferralInfo>;
}

export interface ExchangeContract {
  buyPRANA(usdtAmount: string): Promise<any>;
  sellPRANA(pranaAmount: string): Promise<any>;
  getExchangeRate(): Promise<string>;
  getMinimumAmounts(): Promise<{ buyMin: string; sellMin: string }>;
  getPRANABalance(): Promise<string>;
  getUSDTBalance(): Promise<string>;
  getTotalVolume(): Promise<string>;
}

export interface StakeInfo {
  amount: string;
  timestamp: number;
  totalRewards: string;
  claimedRewards: string;
  roiPercentage: number;
  isActive: boolean;
  maxRewards: string;
}

export interface ReferralInfo {
  referrer: string;
  referrals: string[];
  totalCommission: string;
  level1Commission: string;
  level2Commission: string;
  level3Commission: string;
}

export interface ContractAddresses {
  pranaToken: string;
  staking: string;
  exchange: string;
  referral?: string;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
  receipt?: any;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrls: {
    primary: string;
    fallbacks: string[];
  };
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Token distribution as per TDD requirements
export const TOKEN_DISTRIBUTION = {
  referralProgram: { percent: 24, amount: "5.04B" },
  ecosystemDev: { percent: 20, amount: "4.20B" },
  investorStaking: { percent: 15, amount: "3.15B" },
  validatorStaking: { percent: 10, amount: "2.10B" },
  treasury: { percent: 10, amount: "2.10B" },
  founders: { percent: 10, amount: "2.10B" },
  daoGovernance: { percent: 6, amount: "1.26B" },
  earlyContributors: { percent: 5, amount: "1.05B" }
} as const;

// Staking constants from TDD requirements
export const STAKING_CONSTANTS = {
  TOTAL_SUPPLY: "21000000000", // 21 billion PRANA
  EXCHANGE_RATE: "0.10", // 1 PRANA = 0.10 USDT
  DAILY_ROI: 0.012, // 1.2% daily
  ANNUAL_APY: 0.12, // 12% annual
  MAX_ROI_MULTIPLE: 2, // 200% cap
  MINIMUM_STAKE: "10", // 10 PRANA minimum
  MINIMUM_BUY_USDT: "50", // 50 USDT minimum buy
  MINIMUM_SELL_USDT_EQUIVALENT: "100", // 100 USDT equivalent minimum sell
} as const;

// Referral commission structure
export const REFERRAL_COMMISSIONS = {
  level1: 0.04, // 4%
  level2: 0.02, // 2%
  level3: 0.01, // 1%
  level4: 0.01, // 1%
  level5: 0.01, // 1%
  level6: 0.01, // 1%
  level7: 0.01, // 1%
  level8: 0.01, // 1%
} as const;