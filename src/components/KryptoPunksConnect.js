/**
 * KryptoPunks-Style Connect Component
 * Direct adaptation from KryptoPunks-nft-staking-dapp/front-end/src/components/Connect.js
 * Maintains the same structure and patterns
 */

import React, { useState, useEffect } from 'react';
import { kryptoPunksWallet } from '../services/KryptoPunksStyleWallet.js';
import { stateManager } from '../services/StateManagerService.js';

function KryptoPunksConnect() {
    const [accountData, setAccountData] = useState({
        account: "",
        balance: 0,
        network: ""
    });
    const [show, setShow] = useState(false);

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    /**
     * Connect function - exact KryptoPunks pattern
     */
    async function fetchAccountData() {
        const result = await kryptoPunksWallet.connect();
        
        if (result.success) {
            setAccountData({
                account: result.account,
                balance: result.balance,
                network: result.network
            });
            
            console.log({
                account: result.account,
                balance: result.balance,
                network: result.network
            });
        } else {
            console.error("Connection failed:", result.error);
            alert(result.error);
        }
    }

    /**
     * Disconnect function - exact KryptoPunks pattern
     */
    async function Disconnect() {
        const result = await kryptoPunksWallet.disconnect();
        
        if (result.success) {
            setAccountData({
                account: "",
                balance: 0,
                network: ""
            });
            setShow(false);
        }
    }

    /**
     * Setup event listeners - KryptoPunks style
     */
    useEffect(() => {
        const handleAccountChange = () => {
            const info = kryptoPunksWallet.getAccountInfo();
            if (info.isConnected) {
                setAccountData({
                    account: info.account,
                    balance: info.balance,
                    network: info.network
                });
            }
        };

        // Subscribe to state changes
        const unsubscribe = stateManager.subscribe(handleAccountChange, 'wallet');
        
        return () => {
            unsubscribe();
        };
    }, []);

    const isConnected = accountData.account !== "";

    return (
        <>
            {isConnected ? (
                <>
                    <button 
                        className="btn btn-secondary m-2 rounded"
                        onClick={handleShow}
                        style={{
                            background: 'linear-gradient(45deg, #667eea, #764ba2)',
                            border: 'none',
                            color: 'white'
                        }}
                    >
                        {accountData.account &&
                            `${accountData.account.slice(0, 6)}...${accountData.account.slice(
                                accountData.account.length - 6,
                                accountData.account.length
                            )}`}
                    </button>
                    
                    {/* Modal - simplified for vanilla JS environment */}
                    {show && (
                        <div 
                            style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                background: 'white',
                                padding: '20px',
                                borderRadius: '10px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                                zIndex: 1000,
                                minWidth: '300px'
                            }}
                        >
                            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                                <h4 style={{ margin: 0, color: '#333' }}>User Wallet</h4>
                                <button 
                                    onClick={handleClose}
                                    style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '15px',
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '20px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                                <p><strong>Account:</strong> {accountData.account}</p>
                                <p><strong>Balance:</strong> {accountData.balance && parseFloat(accountData.balance).toFixed(4)} ETH</p>
                                <p><strong>Network:</strong> {accountData.network}</p>
                            </div>
                            
                            <div style={{ textAlign: 'right' }}>
                                <button
                                    onClick={Disconnect}
                                    style={{
                                        background: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '5px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Backdrop */}
                    {show && (
                        <div 
                            onClick={handleClose}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.5)',
                                zIndex: 999
                            }}
                        />
                    )}
                </>
            ) : (
                <button 
                    className="btn btn-secondary m-2 rounded" 
                    onClick={fetchAccountData}
                    style={{
                        background: 'linear-gradient(45deg, #667eea, #764ba2)',
                        border: 'none',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Connect Wallet
                </button>
            )}
        </>
    );
}

export default KryptoPunksConnect;