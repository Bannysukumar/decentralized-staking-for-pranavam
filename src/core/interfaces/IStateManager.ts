/**
 * IStateManager - Interface for blockchain state management
 * Following Dependency Inversion Principle
 */

export interface StateUpdate {
    type: string;
    data: any;
    timestamp: number;
    blockNumber?: number;
    transactionHash?: string;
}

export interface IStateManager {
    subscribe(event: string, callback: (update: StateUpdate) => void): void;
    unsubscribe(event: string, callback: (update: StateUpdate) => void): void;
    getState(key: string): any;
    updateState(key: string, value: any, metadata?: any): void;
    syncState(blockNumber?: number): Promise<void>;
    watchContract(contractName: string, events: string[]): void;
    unwatchContract(contractName: string): void;
}