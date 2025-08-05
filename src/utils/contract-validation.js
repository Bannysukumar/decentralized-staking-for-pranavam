/**
 * Contract Validation Utilities
 * Helper functions to check if contracts are deployed and available
 */

import { isValidContractAddress } from '../config/contracts.js';

/**
 * Check if a contract is deployed and available
 * @param {Object} contractService - Contract service instance
 * @param {string} contractName - Name of the contract to check
 * @returns {boolean} Whether contract is available
 */
export function isContractAvailable(contractService, contractName) {
    try {
        const contract = contractService.getContract(contractName);
        return !!contract;
    } catch (error) {
        return false;
    }
}

/**
 * Check if a contract address is valid (not zero address)
 * @param {Object} contractService - Contract service instance
 * @param {string} contractName - Name of the contract to check
 * @returns {boolean} Whether contract address is valid
 */
export function isContractDeployed(contractService, contractName) {
    try {
        const address = contractService.getContractAddress(contractName);
        return isValidContractAddress(address);
    } catch (error) {
        return false;
    }
}

/**
 * Get zero/default values for when contracts are not available
 * @param {string} dataType - Type of data (balance, stats, etc.)
 * @returns {Object} Default values
 */
export function getContractUnavailableDefaults(dataType) {
    const defaults = {
        balance: '0',
        stakes: [],
        stats: {
            totalStaked: '0',
            totalRewardsPaid: '0',
            totalReferralsPaid: '0',
            contractBalance: '0'
        },
        reserves: {
            pranaReserve: '0',
            usdtReserve: '0',
            exchangeAddress: '0x0000000000000000000000000000000000000000',
            exchangeRate: 0,
            totalValueLocked: {
                usdt: '0',
                pranaValueInUsdt: '0'
            },
            pranaTotalSupply: '0',
            usdtTotalSupply: '0',
            lastUpdate: Date.now()
        },
        referralInfo: {
            referrer: '0x0000000000000000000000000000000000000000',
            directCount: 0,
            earnings: '0'
        },
        userInfo: {
            stakes: [],
            totalStaked: '0',
            availableRewards: '0',
            stakesCount: 0
        }
    };

    return defaults[dataType] || {};
}

/**
 * Wrap a service method to handle contract unavailability
 * @param {Function} serviceMethod - The service method to wrap
 * @param {Object} contractService - Contract service instance
 * @param {string|Array} requiredContracts - Contract name(s) required for this method
 * @param {string} defaultType - Type of default values to return
 * @returns {Function} Wrapped method
 */
export function withContractValidation(serviceMethod, contractService, requiredContracts, defaultType) {
    return async function(...args) {
        const contracts = Array.isArray(requiredContracts) ? requiredContracts : [requiredContracts];
        
        // Check if all required contracts are available
        for (const contractName of contracts) {
            if (!isContractAvailable(contractService, contractName)) {
                console.warn(`Contract ${contractName} not available - returning default values`);
                return {
                    success: true,
                    ...getContractUnavailableDefaults(defaultType)
                };
            }
        }
        
        // All contracts available, call the original method
        return await serviceMethod.apply(this, args);
    };
}