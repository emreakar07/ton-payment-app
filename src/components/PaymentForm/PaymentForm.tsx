import React, { useEffect, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import { createClient } from '@supabase/supabase-js';
import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';
import './PaymentForm.scss';

interface PaymentParams {
    amount: string;
    address: string;
    orderId: string;
    productName: string;
    epin?: string;
}

// Transaction mesaj tipi
interface TonMessage {
    destination?: string;
    value: string;
}

// Transaction tipi
interface TonTransaction {
    out_msgs: TonMessage[];
}

export const PaymentForm = () => {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null);
    const [isValidAccess, setIsValidAccess] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
    const [transactionHash, setTransactionHash] = useState<string | null>(null);

    // Supabase client
    const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    );

    // TON Client - TON Console API ile
    const tonClient = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: import.meta.env.VITE_TON_API_KEY
    });

    // Telegram WebApp'i başlat
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            // Mini App'i hazırla
            tg.ready();
            
            // Tam ekran yap
            tg.expand();
            
            // Kapatma onayını aktifleştir
            tg.enableClosingConfirmation();

            // Tema renklerini ayarla
            if (tg.themeParams) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
                document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
                document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
                document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color);
            }
        }
    }, []);

    // URL parametrelerini kontrol et
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const amount = urlParams.get('amount');
        const address = urlParams.get('address');
        const orderId = urlParams.get('orderId');
        const productName = urlParams.get('productName');
        const epin = urlParams.get('epin');

        if (amount && address && orderId) {
            setPaymentParams({
                amount,
                address,
                orderId,
                productName: productName || 'Product',
                epin: epin || undefined
            });
            setIsValidAccess(true);
        }
    }, []);

    const handleWalletAction = () => {
        if (wallet) {
            tonConnectUI.disconnect();
        } else {
            tonConnectUI.openModal();
        }
    };

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
            
            if (result) {
                setTransactionHash(result.boc);
                setPaymentStatus('success');

                // Telegram'a başarılı sonucu gönder
                const tg = window.Telegram?.WebApp;
                if (tg) {
                    tg.sendData(JSON.stringify({
                        status: 'success',
                        orderId: paymentParams.orderId,
                        txHash: result.boc
                    }));
                }
            }
        } catch (error) {
            console.error('Payment error:', error);
            setPaymentStatus('failed');

            // Telegram'a hata sonucunu gönder
            const tg = window.Telegram?.WebApp;
            if (tg) {
                tg.sendData(JSON.stringify({
                    status: 'failed',
                    orderId: paymentParams.orderId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }));
            }
        }
    };

    if (!isValidAccess) {
        return (
            <div className="payment-form">
                <div className="error-message">Invalid payment parameters</div>
            </div>
        );
    }

    return (
        <div className="payment-form">
            <div className="transaction-info">
                <h3>{paymentParams?.productName || 'Payment Details'}</h3>
                
                <div className="info-row">
                    <span>Amount:</span>
                    <span>{paymentParams?.amount} TON</span>
                </div>

                {paymentParams?.epin && (
                    <div className="info-row">
                        <span>E-PIN:</span>
                        <span>{paymentParams.epin}</span>
                    </div>
                )}

                <div className="info-row">
                    <span>To:</span>
                    <span className="address">{paymentParams?.address}</span>
                </div>

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