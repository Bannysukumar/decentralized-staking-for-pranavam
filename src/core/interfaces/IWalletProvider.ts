/**
 * IWalletProvider - Interface for wallet connection providers
 * Following Single Responsibility Principle
 */

export interface WalletConnectionResult {
    account: string;
    chainId: number;
    provider: any;
    web3: any;
}

export interface IWalletProvider {
    readonly name: string;
    readonly isAvailable: boolean;
    
    connect(): Promise<WalletConnectionResult>;
    disconnect(): Promise<void>;
    switchNetwork(chainId: number): Promise<void>;
    getAccounts(): Promise<string[]>;
    isConnected(): boolean;
}