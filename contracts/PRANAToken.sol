// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PRANA Token
 * @dev ERC20 Token with 21 billion total supply
 * Features: Burnable, Pausable, Ownable
 */
contract PRANAToken is ERC20, ERC20Burnable, Ownable, Pausable {
    uint256 public constant TOTAL_SUPPLY = 21_000_000_000 * 10**18; // 21 billion tokens
    
    // Token distribution tracking
    mapping(address => bool) public distributors;
    uint256 public totalDistributed;
    
    event DistributorAdded(address indexed distributor);
    event DistributorRemoved(address indexed distributor);
    event TokensDistributed(address indexed to, uint256 amount);

    constructor() ERC20("PRANA", "PRANA") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
        distributors[msg.sender] = true;
        emit DistributorAdded(msg.sender);
    }

    /**
     * @dev Add a distributor address
     */
    function addDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "Invalid distributor address");
        distributors[_distributor] = true;
        emit DistributorAdded(_distributor);
    }

    /**
     * @dev Remove a distributor address
     */
    function removeDistributor(address _distributor) external onlyOwner {
        distributors[_distributor] = false;
        emit DistributorRemoved(_distributor);
    }

    /**
     * @dev Distribute tokens (only by distributors)
     */
    function distribute(address to, uint256 amount) external {
        require(distributors[msg.sender], "Not authorized to distribute");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        
        _transfer(msg.sender, to, amount);
        totalDistributed += amount;
        emit TokensDistributed(to, amount);
    }

    /**
     * @dev Pause token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override transfer to include pause functionality
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(!paused(), "Token transfers are paused");
        super._update(from, to, amount);
    }

    /**
     * @dev Get remaining undistributed tokens
     */
    function getRemainingTokens() external view returns (uint256) {
        return balanceOf(owner());
    }

    // Emergency withdrawal events
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed recipient);
    event EmergencyWithdrawETH(uint256 amount, address indexed recipient);
    
    /**
     * @dev Emergency withdrawal for ETH (only owner)
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH balance to withdraw");
        
        payable(owner()).transfer(balance);
        emit EmergencyWithdrawETH(balance, owner());
    }
    
    /**
     * @dev Emergency withdrawal for ERC20 tokens (only owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(token != address(this), "Cannot withdraw own tokens");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20 tokenContract = IERC20(token);
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient token balance");
        
        tokenContract.transfer(owner(), amount);
        emit EmergencyWithdraw(token, amount, owner());
    }
}