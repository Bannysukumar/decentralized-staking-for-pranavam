// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Mock USDT Token
 * @dev Mock USDT token for testing purposes
 */
contract MockUSDT is ERC20, Ownable {
    constructor() ERC20("Mock USDT", "USDT") Ownable(msg.sender) {
        // Mint 1 billion USDT for testing (6 decimals)
        _mint(msg.sender, 1_000_000_000 * 10**6);
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDT has 6 decimals
    }

    // Allow anyone to mint for testing purposes
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // Faucet function for testing
    function faucet() external {
        _mint(msg.sender, 10000 * 10**6); // 10,000 USDT
    }
}