import React, { useEffect, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import CryptoJS from 'crypto-js';
import './PaymentForm.scss';

interface PaymentParams {
    amount: string;
    address: string;
    orderId: string;
    productName: string;
    epin?: string;
}

export const PaymentForm = () => {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null);
    const [isValidAccess, setIsValidAccess] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
    const [transactionHash, setTransactionHash] = useState<string | null>(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const address = urlParams.get('address');
        const orderId = urlParams.get('orderId');
        const amount = urlParams.get('amount');
        const epin = urlParams.get('epin');

        if (address && orderId && amount) {
            setIsValidAccess(true);
            setPaymentParams({
                amount: amount,
                address: address,
                orderId: orderId,
                productName: urlParams.get('productName') || 'Product',
                epin: epin || undefined
            });
        } else {
            setIsValidAccess(false);
        }
    }, []);

    // Otomatik disconnect için useEffect
    useEffect(() => {
        if (wallet) {
            // 5 dakika sonra otomatik disconnect
            const disconnectTimeout = setTimeout(() => {
                tonConnectUI.disconnect();
            }, 5 * 60 * 1000); // 5 dakika

            // Component unmount olduğunda veya wallet değiştiğinde timeout'u temizle
            return () => clearTimeout(disconnectTimeout);
        }
    }, [wallet, tonConnectUI]);

    const handlePayment = async () => {
        if (!wallet || !paymentParams) return;

        try {
            setPaymentStatus('pending');
            
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [
                    {
                        address: paymentParams.address,
                        amount: toNano(paymentParams.amount).toString(),
                    }
                ]
            };

            const result = await tonConnectUI.sendTransaction(transaction);
            const txHash = result.boc;
            
            setTransactionHash(txHash);
            setPaymentStatus('success');

            const timestamp = Date.now();
            const data = {
                status: 'success',
                orderId: paymentParams.orderId,
                txHash: txHash,
                amount: paymentParams.amount,
                timestamp
            };

            // HMAC imzası oluştur
            const webhookData = {
                data,
                signature: generateSignature(data, import.meta.env.VITE_WEBHOOK_SECRET || ''),
                timestamp
            };

            // Webhook'u gönder
            if ('Telegram' in window && window.Telegram?.WebApp) {
                window.Telegram.WebApp.sendData(JSON.stringify(webhookData));
                
                setTimeout(() => {
                    if ('Telegram' in window && window.Telegram?.WebApp) {
                        window.Telegram.WebApp.close();
                    }
                }, 2000);
            }

        } catch (error) {
            console.error('Payment failed:', error);
            setPaymentStatus('failed');
            
            const timestamp = Date.now();
            const data = {
                status: 'failed',
                orderId: paymentParams.orderId,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                timestamp
            };

            // Hata durumunda webhook
            const webhookData = {
                data,
                signature: generateSignature(data, import.meta.env.VITE_WEBHOOK_SECRET || ''),
                timestamp
            };

            if ('Telegram' in window && window.Telegram?.WebApp) {
                window.Telegram.WebApp.sendData(JSON.stringify(webhookData));
            }
        }
    };

    // HMAC imzası oluşturma fonksiyonu
    const generateSignature = (data: any, secretKey: string): string => {
        const message = JSON.stringify(data);
        return CryptoJS.HmacSHA256(message, secretKey).toString();
    };

    const handleWalletAction = () => {
        if (wallet) {
            tonConnectUI.disconnect();
        } else {
            tonConnectUI.openModal();
        }
    };

    if (!isValidAccess) {
        return (
            <div className="payment-form">
                <div className="error-message">
                    <h3>Invalid Access</h3>
                    <p>This payment form requires valid parameters (address, orderId, and amount).</p>
                </div>
            </div>
        );
    }

    return (
        <div className="payment-form">
            <div className="transaction-info">
                <h3>Transaction Details</h3>
                <div className="info-row">
                    <span>Amount:</span>
                    <span>{paymentParams?.amount} TON</span>
                </div>
                <div className="info-row">
                    <span>To Address:</span>
                    <span className="address">{paymentParams?.address}</span>
                </div>
                
                {/* Ödeme durumu gösterimi */}
                {paymentStatus && (
                    <div className={`status-message ${paymentStatus}`}>
                        {paymentStatus === 'pending' && <p>Processing payment...</p>}
                        {paymentStatus === 'success' && (
                            <>
                                <p>Payment Successful!</p>
                                {transactionHash && (
                                    <small className="tx-hash">
                                        TX: {transactionHash.slice(0, 8)}...{transactionHash.slice(-8)}
                                    </small>
                                )}
                            </>
                        )}
                        {paymentStatus === 'failed' && <p>Payment Failed. Please try again.</p>}
                    </div>
                )}
            </div>

            <div className="action-buttons">
                <button 
                    className={`wallet-button ${wallet ? 'connected' : ''}`}
                    onClick={handleWalletAction}
                >
                    {wallet ? 'Disconnect Wallet' : 'Connect Wallet'}
                </button>
                
                {wallet && !['success', 'pending'].includes(paymentStatus || '') && (
                    <button 
                        className="send-button"
                        onClick={handlePayment}
                    >
                        Send Transaction
                    </button>
                )}
            </div>
        </div>
    );
}; 