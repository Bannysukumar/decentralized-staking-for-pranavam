/**
 * ITransactionManager - Interface for transaction handling
 * Following Single Responsibility and Open/Closed Principles
 */

export interface TransactionOptions {
    from?: string;
    gas?: number;
    gasPrice?: string;
    value?: string;
    [key: string]: any;
}

export interface TransactionResult {
    transactionHash: string;
    blockNumber: number;
    gasUsed: number;
    status: boolean;
    events?: any[];
}

export interface TransactionRequest {
    contractName: string;
    methodName: string;
    params: any[];
    options?: TransactionOptions;
}

export interface ITransactionManager {
    executeTransaction(request: TransactionRequest): Promise<TransactionResult>;
    estimateGas(request: TransactionRequest): Promise<number>;
    getTransactionStatus(txHash: string): Promise<any>;
    cancelTransaction(txHash: string): Promise<boolean>;
}