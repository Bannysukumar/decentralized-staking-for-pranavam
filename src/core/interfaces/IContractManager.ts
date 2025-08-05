/**
 * IContractManager - Interface for contract management
 * Following Interface Segregation Principle
 */

export interface ContractInstance {
    address: string;
    abi: any[];
    contract: any;
    methods: any;
}

export interface IContractManager {
    loadContract(name: string, address: string, abi: any[]): Promise<ContractInstance>;
    getContract(name: string): ContractInstance | null;
    getAllContracts(): Map<string, ContractInstance>;
    refreshContract(name: string): Promise<ContractInstance>;
    isContractLoaded(name: string): boolean;
}