// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PRANA Exchange Contract
 * @dev Exchange contract for PRANA/USDT trading with fixed rates
 */
contract PRANAExchange is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable pranaToken;
    IERC20 public immutable usdtToken;
    
    // Exchange rates (in basis points for precision)
    uint256 public constant EXCHANGE_RATE_BASE = 1000; // 0.1 USDT per PRANA (1000/10000)
    uint256 public constant RATE_PRECISION = 10000;
    
    // Minimum amounts
    uint256 public constant MINIMUM_BUY_USDT = 50 * 10**6; // 50 USDT (6 decimals)
    uint256 public constant MINIMUM_SELL_USDT_EQUIVALENT = 100 * 10**6; // 100 USDT equivalent
    
    // Fee structure (basis points)
    uint256 public buyFee = 50; // 0.5%
    uint256 public sellFee = 50; // 0.5%
    uint256 public constant MAX_FEE = 1000; // 10% maximum
    
    // Statistics
    uint256 public totalVolume;
    uint256 public totalTransactions;
    mapping(address => uint256) public userVolume;
    
    // Liquidity management
    address public liquidityProvider;
    uint256 public pranaReserve;
    uint256 public usdtReserve;
    
    // Events
    event PRANAPurchased(address indexed buyer, uint256 usdtAmount, uint256 pranaAmount, uint256 fee);
    event PRANASold(address indexed seller, uint256 pranaAmount, uint256 usdtAmount, uint256 fee);
    event LiquidityAdded(address indexed provider, uint256 pranaAmount, uint256 usdtAmount);
    event LiquidityRemoved(address indexed provider, uint256 pranaAmount, uint256 usdtAmount);
    event FeesUpdated(uint256 buyFee, uint256 sellFee);
    event LiquidityProviderUpdated(address indexed oldProvider, address indexed newProvider);
    
    constructor(
        address _pranaToken,
        address _usdtToken,
        address _liquidityProvider
    ) Ownable(msg.sender) {
        require(_pranaToken != address(0), "Invalid PRANA token address");
        require(_usdtToken != address(0), "Invalid USDT token address");
        require(_liquidityProvider != address(0), "Invalid liquidity provider");
        
        pranaToken = IERC20(_pranaToken);
        usdtToken = IERC20(_usdtToken);
        liquidityProvider = _liquidityProvider;
    }
    
    /**
     * @dev Buy PRANA tokens with USDT
     */
    function buyPRANA(uint256 usdtAmount) external nonReentrant whenNotPaused {
        require(usdtAmount >= MINIMUM_BUY_USDT, "Amount below minimum buy");
        require(usdtAmount > 0, "Amount must be greater than 0");
        
        // Calculate PRANA amount (USDT has 6 decimals, PRANA has 18)
        uint256 pranaAmount = (usdtAmount * RATE_PRECISION * 10**12) / EXCHANGE_RATE_BASE;
        
        // Calculate fee
        uint256 fee = (pranaAmount * buyFee) / RATE_PRECISION;
        uint256 pranaToUser = pranaAmount - fee;
        
        // Check liquidity
        require(pranaToken.balanceOf(address(this)) >= pranaAmount, "Insufficient PRANA liquidity");
        
        // Transfer USDT from user
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        
        // Transfer PRANA to user
        pranaToken.safeTransfer(msg.sender, pranaToUser);
        
        // Transfer fee to liquidity provider
        if (fee > 0) {
            pranaToken.safeTransfer(liquidityProvider, fee);
        }
        
        // Update statistics
        totalVolume += usdtAmount;
        totalTransactions++;
        userVolume[msg.sender] += usdtAmount;
        
        // Update reserves
        pranaReserve = pranaToken.balanceOf(address(this));
        usdtReserve = usdtToken.balanceOf(address(this));
        
        emit PRANAPurchased(msg.sender, usdtAmount, pranaToUser, fee);
    }
    
    /**
     * @dev Sell PRANA tokens for USDT
     */
    function sellPRANA(uint256 pranaAmount) external nonReentrant whenNotPaused {
        require(pranaAmount > 0, "Amount must be greater than 0");
        
        // Calculate USDT amount
        uint256 usdtAmount = (pranaAmount * EXCHANGE_RATE_BASE) / (RATE_PRECISION * 10**12);
        require(usdtAmount >= MINIMUM_SELL_USDT_EQUIVALENT, "Amount below minimum sell equivalent");
        
        // Calculate fee
        uint256 fee = (usdtAmount * sellFee) / RATE_PRECISION;
        uint256 usdtToUser = usdtAmount - fee;
        
        // Check liquidity
        require(usdtToken.balanceOf(address(this)) >= usdtAmount, "Insufficient USDT liquidity");
        
        // Transfer PRANA from user
        pranaToken.safeTransferFrom(msg.sender, address(this), pranaAmount);
        
        // Transfer USDT to user
        usdtToken.safeTransfer(msg.sender, usdtToUser);
        
        // Transfer fee to liquidity provider
        if (fee > 0) {
            usdtToken.safeTransfer(liquidityProvider, fee);
        }
        
        // Update statistics
        totalVolume += usdtAmount;
        totalTransactions++;
        userVolume[msg.sender] += usdtAmount;
        
        // Update reserves
        pranaReserve = pranaToken.balanceOf(address(this));
        usdtReserve = usdtToken.balanceOf(address(this));
        
        emit PRANASold(msg.sender, pranaAmount, usdtToUser, fee);
    }
    
    /**
     * @dev Add liquidity to the exchange
     */
    function addLiquidity(uint256 pranaAmount, uint256 usdtAmount) external {
        require(msg.sender == liquidityProvider || msg.sender == owner(), "Not authorized");
        require(pranaAmount > 0 && usdtAmount > 0, "Amounts must be greater than 0");
        
        // Transfer tokens to contract
        pranaToken.safeTransferFrom(msg.sender, address(this), pranaAmount);
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        
        // Update reserves
        pranaReserve = pranaToken.balanceOf(address(this));
        usdtReserve = usdtToken.balanceOf(address(this));
        
        emit LiquidityAdded(msg.sender, pranaAmount, usdtAmount);
    }
    
    /**
     * @dev Remove liquidity from the exchange
     */
    function removeLiquidity(uint256 pranaAmount, uint256 usdtAmount) external {
        require(msg.sender == liquidityProvider || msg.sender == owner(), "Not authorized");
        require(pranaAmount > 0 || usdtAmount > 0, "At least one amount must be greater than 0");
        
        // Transfer tokens back to liquidity provider
        if (pranaAmount > 0) {
            pranaToken.safeTransfer(msg.sender, pranaAmount);
        }
        if (usdtAmount > 0) {
            usdtToken.safeTransfer(msg.sender, usdtAmount);
        }
        
        // Update reserves
        pranaReserve = pranaToken.balanceOf(address(this));
        usdtReserve = usdtToken.balanceOf(address(this));
        
        emit LiquidityRemoved(msg.sender, pranaAmount, usdtAmount);
    }
    
    /**
     * @dev Get current exchange rate (USDT per PRANA)
     */
    function getExchangeRate() external pure returns (uint256) {
        return EXCHANGE_RATE_BASE; // 0.1 USDT per PRANA
    }
    
    /**
     * @dev Get minimum amounts for trading
     */
    function getMinimumAmounts() external pure returns (uint256 buyMin, uint256 sellMin) {
        return (MINIMUM_BUY_USDT, MINIMUM_SELL_USDT_EQUIVALENT);
    }
    
    /**
     * @dev Get contract token balances
     */
    function getBalances() external view returns (uint256 pranaBalance, uint256 usdtBalance) {
        return (pranaToken.balanceOf(address(this)), usdtToken.balanceOf(address(this)));
    }
    
    /**
     * @dev Calculate buy quote
     */
    function getBuyQuote(uint256 usdtAmount) external view returns (uint256 pranaAmount, uint256 fee) {
        if (usdtAmount < MINIMUM_BUY_USDT) return (0, 0);
        
        uint256 grossPrana = (usdtAmount * RATE_PRECISION * 10**12) / EXCHANGE_RATE_BASE;
        fee = (grossPrana * buyFee) / RATE_PRECISION;
        pranaAmount = grossPrana - fee;
    }
    
    /**
     * @dev Calculate sell quote
     */
    function getSellQuote(uint256 pranaAmount) external view returns (uint256 usdtAmount, uint256 fee) {
        if (pranaAmount == 0) return (0, 0);
        
        uint256 grossUsdt = (pranaAmount * EXCHANGE_RATE_BASE) / (RATE_PRECISION * 10**12);
        if (grossUsdt < MINIMUM_SELL_USDT_EQUIVALENT) return (0, 0);
        
        fee = (grossUsdt * sellFee) / RATE_PRECISION;
        usdtAmount = grossUsdt - fee;
    }
    
    /**
     * @dev Owner functions
     */
    function setFees(uint256 _buyFee, uint256 _sellFee) external onlyOwner {
        require(_buyFee <= MAX_FEE && _sellFee <= MAX_FEE, "Fee too high");
        buyFee = _buyFee;
        sellFee = _sellFee;
        emit FeesUpdated(_buyFee, _sellFee);
    }
    
    function setLiquidityProvider(address _liquidityProvider) external onlyOwner {
        require(_liquidityProvider != address(0), "Invalid address");
        address oldProvider = liquidityProvider;
        liquidityProvider = _liquidityProvider;
        emit LiquidityProviderUpdated(oldProvider, _liquidityProvider);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Emergency withdrawal events
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed recipient);
    
    /**
     * @dev Emergency withdrawal (owner only) with enhanced security
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient contract balance");
        
        // Prevent withdrawing exchange reserves for trading
        if (token == address(pranaToken)) {
            require(amount <= getExcessBalance(token), "Cannot withdraw trading reserves");
        } else if (token == address(usdtToken)) {
            require(amount <= getExcessBalance(token), "Cannot withdraw trading reserves");
        }
        
        IERC20(token).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(token, amount, owner());
    }
    
    /**
     * @dev Get excess token balance available for emergency withdrawal
     */
    function getExcessBalance(address token) public view returns (uint256) {
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        
        // For trading pairs, keep minimum reserves for operations
        if (token == address(pranaToken)) {
            return contractBalance > pranaReserve ? contractBalance - pranaReserve : 0;
        } else if (token == address(usdtToken)) {
            return contractBalance > usdtReserve ? contractBalance - usdtReserve : 0;
        }
        
        // For other tokens, entire balance is available
        return contractBalance;
    }
}