import React, { useEffect, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import './PaymentForm.scss';

interface PaymentParams {
    amount: string;
    address: string;
    orderId: string;
    productName: string;
}

interface TransactionError {
    message: string;
}

export const PaymentForm = () => {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null);
    const [isValidAccess, setIsValidAccess] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const address = urlParams.get('address');
        const orderId = urlParams.get('orderId');
        const amount = urlParams.get('amount');

        if (address && orderId && amount) {
            setIsValidAccess(true);
            setPaymentParams({
                amount: amount,
                address: address,
                orderId: orderId,
                productName: urlParams.get('productName') || 'Product'
            });
        } else {
            setIsValidAccess(false);
        }
    }, []);

    const handlePayment = async () => {
        if (!wallet || !paymentParams) return;

        try {
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
            
            const callbackUrl = new URLSearchParams(window.location.search).get('callback_url');
            if (callbackUrl) {
                try {
                    await fetch(callbackUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            status: 'success',
                            orderId: paymentParams.orderId,
                            txHash: txHash,
                            amount: paymentParams.amount,
                            address: paymentParams.address
                        })
                    });
                } catch (callbackError) {
                    console.error('Callback failed:', callbackError);
                }
            }

            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.sendData(JSON.stringify({
                    status: 'success',
                    orderId: paymentParams.orderId,
                    txHash: txHash
                }));
            }

        } catch (error) {
            console.error('Payment failed:', error);
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            const callbackUrl = new URLSearchParams(window.location.search).get('callback_url');
            if (callbackUrl) {
                try {
                    await fetch(callbackUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            status: 'failed',
                            orderId: paymentParams.orderId,
                            error: errorMessage
                        })
                    });
                } catch (callbackError) {
                    console.error('Callback failed:', callbackError);
                }
            }

            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.sendData(JSON.stringify({
                    status: 'failed',
                    orderId: paymentParams.orderId,
                    error: errorMessage
                }));
            }
        }
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
            </div>

            <div className="action-buttons">
                <button 
                    className={`wallet-button ${wallet ? 'connected' : ''}`}
                    onClick={handleWalletAction}
                >
                    {wallet ? 'Disconnect Wallet' : 'Connect Wallet'}
                </button>
                
                {wallet && (
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