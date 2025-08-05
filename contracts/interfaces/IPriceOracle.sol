// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPriceOracle
 * @dev Interface for PRANA price oracle
 */
interface IPriceOracle {
    /**
     * @dev Get current PRANA price in USDT
     * @return price Current price in 6 decimal places (USDT format)
     */
    function getPrice() external view returns (uint256 price);
    
    /**
     * @dev Get price with timestamp
     * @return price Current price
     * @return timestamp Last update timestamp
     */
    function getPriceWithTimestamp() external view returns (uint256 price, uint256 timestamp);
    
    /**
     * @dev Check if price is stale
     * @return isStale True if price is older than threshold
     */
    function isPriceStale() external view returns (bool isStale);
}