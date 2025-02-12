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
        const webapp = window.Telegram?.WebApp;
        if (webapp) {
            // WebApp'i hazırla
            webapp.ready();
            
            // Ana butonu ayarla
            webapp.MainButton.setText(wallet ? 'SEND PAYMENT' : 'CONNECT WALLET');
            webapp.MainButton.show();

            const handleMainButtonClick = () => {
                if (!wallet) {
                    tonConnectUI.openModal();
                } else {
                    handlePayment();
                }
            };

            webapp.MainButton.onClick(handleMainButtonClick);

            // BackButton'ı ayarla
            webapp.BackButton.show();
            
            const handleBackButtonClick = () => {
                webapp.close();
            };
            
            webapp.BackButton.onClick(handleBackButtonClick);

            // Tema renklerini ayarla
            document.body.style.backgroundColor = webapp.backgroundColor;
            document.body.style.color = webapp.textColor;

            // Cleanup
            return () => {
                if (webapp) {
                    webapp.MainButton.offClick(handleMainButtonClick);
                    webapp.BackButton.offClick(handleBackButtonClick);
                }
            };
        }
    }, [wallet]);

    // Payment status değiştiğinde MainButton'ı güncelle
    useEffect(() => {
        const webapp = window.Telegram?.WebApp;
        if (webapp) {
            switch (paymentStatus) {
                case 'pending':
                    webapp.MainButton.showProgress(true);
                    webapp.MainButton.disable();
                    break;
                case 'success':
                    webapp.MainButton.hideProgress();
                    webapp.MainButton.hide();
                    // İşlem başarılı olduğunda veriyi gönder ve kapat
                    if (transactionHash) {
                        webapp.sendData(JSON.stringify({
                            status: 'success',
                            orderId: paymentParams?.orderId,
                            txHash: transactionHash
                        }));
                        setTimeout(() => webapp.close(), 2000);
                    }
                    break;
                case 'failed':
                    webapp.MainButton.hideProgress();
                    webapp.MainButton.enable();
                    webapp.MainButton.setText('TRY AGAIN');
                    break;
                default:
                    webapp.MainButton.hideProgress();
                    webapp.MainButton.enable();
                    webapp.MainButton.setText(wallet ? 'SEND PAYMENT' : 'CONNECT WALLET');
            }
        }
    }, [paymentStatus, wallet, transactionHash]);

    // URL parametrelerini al
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const amount = params.get('amount');
        const orderId = params.get('orderId');
        const productName = params.get('productName');
        const epin = params.get('epin');
        const address = params.get('address');
        
        if (amount && orderId && productName && address) {
            setPaymentParams({
                amount,
                address,
                orderId,
                productName,
                epin: epin || undefined
            });
            setIsValidAccess(true);
        }
    }, []);

    const handleWalletAction = () => {
        const tg = window.Telegram?.WebApp;
        if (wallet) {
            tonConnectUI.disconnect();
        } else {
            // Telegram Mini App içindeyse ve Telegram Wallet varsa
            if (tg && tg.platform === 'tdesktop' || tg?.platform === 'android' || tg?.platform === 'ios') {
                // Direkt Telegram Wallet'ı aç
                tonConnectUI.connectWallet(['telegram-wallet']);
            } else {
                // Değilse normal modal'ı göster
                tonConnectUI.openModal();
            }
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
            }
        } catch (error) {
            console.error('Payment error:', error);
            setPaymentStatus('failed');
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
            </div>
        </div>
    );
}; 