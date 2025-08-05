/**
 * Security Manager
 * Comprehensive security layer for the DeFi platform
 */

import { ethers } from 'ethers';

export interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  addressWhitelist?: string[];
  addressBlacklist?: string[];
  maxTransactionAmount: string;
  requireTwoFactorAuth: boolean;
  sessionTimeout: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface SecurityEvent {
  type: 'RATE_LIMIT' | 'INVALID_ADDRESS' | 'SUSPICIOUS_ACTIVITY' | 'UNAUTHORIZED_ACCESS';
  address: string;
  timestamp: number;
  details: string;
}

export class SecurityManager {
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private securityEvents: SecurityEvent[] = [];
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.startCleanupInterval();
  }

  /**
   * Validate ethereum address format and security
   */
  validateAddress(address: string): { isValid: boolean; reason?: string } {
    // Basic format validation
    if (!ethers.utils.isAddress(address)) {
      return { isValid: false, reason: 'Invalid address format' };
    }

    // Check for zero address
    if (address === ethers.constants.AddressZero) {
      return { isValid: false, reason: 'Zero address not allowed' };
    }

    // Check blacklist
    if (this.config.addressBlacklist?.includes(address.toLowerCase())) {
      this.logSecurityEvent('INVALID_ADDRESS', address, 'Address is blacklisted');
      return { isValid: false, reason: 'Address is blacklisted' };
    }

    // Check whitelist (if configured)
    if (this.config.addressWhitelist && this.config.addressWhitelist.length > 0) {
      if (!this.config.addressWhitelist.includes(address.toLowerCase())) {
        return { isValid: false, reason: 'Address not whitelisted' };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate transaction amount
   */
  validateAmount(amount: string, decimals: number = 18): { isValid: boolean; reason?: string } {
    try {
      const amountBN = ethers.utils.parseUnits(amount, decimals);
      const maxAmountBN = ethers.utils.parseUnits(this.config.maxTransactionAmount, decimals);

      if (amountBN.lte(0)) {
        return { isValid: false, reason: 'Amount must be greater than zero' };
      }

      if (amountBN.gt(maxAmountBN)) {
        return { isValid: false, reason: `Amount exceeds maximum limit of ${this.config.maxTransactionAmount}` };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, reason: 'Invalid amount format' };
    }
  }

  /**
   * Check rate limiting for an address
   */
  checkRateLimit(address: string): { allowed: boolean; reason?: string; resetTime?: number } {
    const now = Date.now();
    const key = address.toLowerCase();
    const entry = this.rateLimitMap.get(key);

    if (!entry) {
      // First request
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.config.rateLimit.windowMs
      });
      return { allowed: true };
    }

    if (now > entry.resetTime) {
      // Window expired, reset
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.config.rateLimit.windowMs
      });
      return { allowed: true };
    }

    if (entry.count >= this.config.rateLimit.maxRequests) {
      // Rate limit exceeded
      this.logSecurityEvent('RATE_LIMIT', address, `Rate limit exceeded: ${entry.count} requests`);
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded',
        resetTime: entry.resetTime
      };
    }

    // Increment counter
    entry.count++;
    return { allowed: true };
  }

  /**
   * Validate transaction parameters for suspicious activity
   */
  validateTransaction(params: {
    from: string;
    to?: string;
    amount: string;
    type: 'stake' | 'unstake' | 'claim' | 'buy' | 'sell';
    referrer?: string;
  }): { isValid: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Validate addresses
    const fromValidation = this.validateAddress(params.from);
    if (!fromValidation.isValid) {
      reasons.push(`Invalid from address: ${fromValidation.reason}`);
    }

    if (params.to) {
      const toValidation = this.validateAddress(params.to);
      if (!toValidation.isValid) {
        reasons.push(`Invalid to address: ${toValidation.reason}`);
      }

      // Check for self-transfer (suspicious for certain operations)
      if (params.from.toLowerCase() === params.to.toLowerCase()) {
        if (params.type === 'stake' && params.referrer === params.from) {
          reasons.push('Self-referral not allowed');
        }
      }
    }

    // Validate referrer if provided
    if (params.referrer && params.referrer !== ethers.constants.AddressZero) {
      const referrerValidation = this.validateAddress(params.referrer);
      if (!referrerValidation.isValid) {
        reasons.push(`Invalid referrer address: ${referrerValidation.reason}`);
      }

      if (params.referrer.toLowerCase() === params.from.toLowerCase()) {
        reasons.push('Cannot refer yourself');
      }
    }

    // Validate amount
    const amountValidation = this.validateAmount(params.amount);
    if (!amountValidation.isValid) {
      reasons.push(`Invalid amount: ${amountValidation.reason}`);
    }

    // Check for patterns that might indicate suspicious activity
    this.checkSuspiciousPatterns(params);

    return {
      isValid: reasons.length === 0,
      reasons
    };
  }

  /**
   * Check for suspicious transaction patterns
   */
  private checkSuspiciousPatterns(params: {
    from: string;
    amount: string;
    type: string;
  }): void {
    // Check for rapid large transactions from same address
    const recentEvents = this.securityEvents
      .filter(event => 
        event.address.toLowerCase() === params.from.toLowerCase() &&
        Date.now() - event.timestamp < 300000 // Last 5 minutes
      );

    if (recentEvents.length > 10) {
      this.logSecurityEvent(
        'SUSPICIOUS_ACTIVITY',
        params.from,
        `High frequency transactions: ${recentEvents.length} in last 5 minutes`
      );
    }

    // Check for unusually large amounts
    try {
      const amount = parseFloat(params.amount);
      if (amount > 1000000) { // 1M tokens
        this.logSecurityEvent(
          'SUSPICIOUS_ACTIVITY',
          params.from,
          `Large transaction amount: ${params.amount} ${params.type}`
        );
      }
    } catch (error) {
      // Invalid amount format already caught elsewhere
    }
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate referral chain to prevent circular references
   */
  validateReferralChain(
    newReferee: string,
    referrer: string,
    existingChain: string[]
  ): { isValid: boolean; reason?: string } {
    const newRefereeLC = newReferee.toLowerCase();
    const referrerLC = referrer.toLowerCase();

    // Check for self-referral
    if (newRefereeLC === referrerLC) {
      return { isValid: false, reason: 'Cannot refer yourself' };
    }

    // Check for circular reference
    if (existingChain.map(addr => addr.toLowerCase()).includes(newRefereeLC)) {
      return { isValid: false, reason: 'Circular referral chain detected' };
    }

    // Check chain length (max 8 levels)
    if (existingChain.length >= 8) {
      return { isValid: false, reason: 'Maximum referral chain length exceeded' };
    }

    return { isValid: true };
  }

  /**
   * Generate secure session token
   */
  generateSessionToken(): string {
    return ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(
        Date.now().toString() + Math.random().toString()
      )
    );
  }

  /**
   * Validate session token
   */
  validateSession(token: string, createdAt: number): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Check if session expired
    if (Date.now() - createdAt > this.config.sessionTimeout) {
      return false;
    }

    // Validate token format (should be a valid hash)
    try {
      return token.startsWith('0x') && token.length === 66;
    } catch {
      return false;
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(
    type: SecurityEvent['type'],
    address: string,
    details: string
  ): void {
    const event: SecurityEvent = {
      type,
      address: address.toLowerCase(),
      timestamp: Date.now(),
      details
    };

    this.securityEvents.push(event);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    console.warn(`🔒 Security Event [${type}]:`, {
      address,
      details,
      timestamp: new Date(event.timestamp).toISOString()
    });
  }

  /**
   * Get security events for an address
   */
  getSecurityEvents(address: string, limit: number = 50): SecurityEvent[] {
    return this.securityEvents
      .filter(event => event.address.toLowerCase() === address.toLowerCase())
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get system-wide security statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    recentEvents: number;
    rateLimit: { active: number; total: number };
    topEventTypes: Record<string, number>;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour ago

    const recentEvents = this.securityEvents.filter(
      event => event.timestamp > oneHourAgo
    );

    const eventTypes = this.securityEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: this.securityEvents.length,
      recentEvents: recentEvents.length,
      rateLimit: {
        active: Array.from(this.rateLimitMap.values()).filter(
          entry => now < entry.resetTime
        ).length,
        total: this.rateLimitMap.size
      },
      topEventTypes: eventTypes
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.rateLimitMap.entries()) {
        if (now > entry.resetTime) {
          this.rateLimitMap.delete(key);
        }
      }
    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Emergency lockdown mode
   */
  private emergencyMode = false;

  enableEmergencyMode(): void {
    this.emergencyMode = true;
    console.error('🚨 EMERGENCY MODE ENABLED - All transactions blocked');
  }

  disableEmergencyMode(): void {
    this.emergencyMode = false;
    console.info('✅ Emergency mode disabled');
  }

  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }

  /**
   * Comprehensive security check for all operations
   */
  performSecurityCheck(params: {
    address: string;
    operation: string;
    amount?: string;
    referrer?: string;
    sessionToken?: string;
    sessionCreatedAt?: number;
  }): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check emergency mode
    if (this.emergencyMode) {
      reasons.push('System is in emergency mode');
      return { allowed: false, reasons };
    }

    // Check rate limiting
    const rateLimitCheck = this.checkRateLimit(params.address);
    if (!rateLimitCheck.allowed) {
      reasons.push(rateLimitCheck.reason || 'Rate limit exceeded');
    }

    // Validate address
    const addressValidation = this.validateAddress(params.address);
    if (!addressValidation.isValid) {
      reasons.push(addressValidation.reason || 'Invalid address');
    }

    // Validate session if provided
    if (params.sessionToken && params.sessionCreatedAt) {
      if (!this.validateSession(params.sessionToken, params.sessionCreatedAt)) {
        reasons.push('Invalid or expired session');
      }
    }

    // Validate amount if provided
    if (params.amount) {
      const amountValidation = this.validateAmount(params.amount);
      if (!amountValidation.isValid) {
        reasons.push(amountValidation.reason || 'Invalid amount');
      }
    }

    // Operation-specific validations
    if (params.operation === 'stake' && params.referrer) {
      if (params.referrer.toLowerCase() === params.address.toLowerCase()) {
        reasons.push('Self-referral not allowed');
      }
    }

    return {
      allowed: reasons.length === 0,
      reasons
    };
  }
}