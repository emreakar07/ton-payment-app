import React, { useEffect, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import './PaymentForm.scss';

interface PaymentParams {
    amount: string;
    address: string;
    orderId: string;
    productName: string;
    epin?: string;
}

interface TelegramWebAppData {
    initData: string;
    initDataUnsafe: {
        query_id: string;
        user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
        };
        auth_date: string;
        hash: string;
        start_param?: string;
    };
}

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebAppData & {
                ready: () => void;
                expand: () => void;
                close: () => void;
                MainButton: {
                    text: string;
                    show: () => void;
                    hide: () => void;
                    enable: () => void;
                    disable: () => void;
                    showProgress: (leaveActive: boolean) => void;
                    hideProgress: () => void;
                    setText: (text: string) => void;
                    onClick: (fn: () => void) => void;
                    offClick: (fn: () => void) => void;
                };
                BackButton: {
                    show: () => void;
                    hide: () => void;
                    onClick: (fn: () => void) => void;
                    offClick: (fn: () => void) => void;
                };
                platform: string;
                sendData: (data: string) => void;
            };
        };
    }
}

export const PaymentForm = () => {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null);
    const [isValidAccess, setIsValidAccess] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
    const [transactionHash, setTransactionHash] = useState<string | null>(null);

    // Telegram WebApp'i başlat ve payment verilerini al
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            // WebApp'i hazırla
            tg.ready();
            tg.expand();

            // Bot'tan gelen verileri kontrol et
            if (tg.initDataUnsafe?.start_param) {
                try {
                    // Bot'tan gelen verileri parse et
                    const paymentData = JSON.parse(decodeURIComponent(tg.initDataUnsafe.start_param));
                    
                    setPaymentParams({
                        amount: paymentData.amount,
                        address: paymentData.address,
                        orderId: paymentData.orderId,
                        productName: paymentData.productName,
                        epin: paymentData.epin
                    });
                    setIsValidAccess(true);

                    // Ana butonu ayarla
                    tg.MainButton.setText(wallet ? 'SEND PAYMENT' : 'CONNECT WALLET');
                    tg.MainButton.show();
                    tg.MainButton.onClick(() => {
                        if (!wallet) {
                            handleWalletAction();
                        } else {
                            handlePayment();
                        }
                    });

                    // BackButton'ı ayarla
                    tg.BackButton.show();
                    tg.BackButton.onClick(() => tg.close());
                } catch (error) {
                    console.error('Error parsing payment data:', error);
                }
            }
        }
    }, [wallet]);

    // Payment status değiştiğinde MainButton'ı güncelle
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            switch (paymentStatus) {
                case 'pending':
                    tg.MainButton.showProgress(true);
                    tg.MainButton.disable();
                    break;
                case 'success':
                    tg.MainButton.hideProgress();
                    tg.MainButton.hide();
                    // İşlem başarılı olduğunda veriyi gönder ve kapat
                    if (transactionHash) {
                        tg.sendData(JSON.stringify({
                            status: 'success',
                            orderId: paymentParams?.orderId,
                            txHash: transactionHash
                        }));
                        setTimeout(() => tg.close(), 2000);
                    }
                    break;
                case 'failed':
                    tg.MainButton.hideProgress();
                    tg.MainButton.enable();
                    tg.MainButton.setText('TRY AGAIN');
                    break;
                default:
                    tg.MainButton.hideProgress();
                    tg.MainButton.enable();
                    tg.MainButton.setText(wallet ? 'SEND PAYMENT' : 'CONNECT WALLET');
            }
        }
    }, [paymentStatus, wallet, transactionHash, paymentParams]);

    const handleWalletAction = () => {
        const tg = window.Telegram?.WebApp;
        if (wallet) {
            tonConnectUI.disconnect();
        } else {
            // Telegram Mini App içindeyse
            if (tg && (tg.platform === 'tdesktop' || tg.platform === 'android' || tg.platform === 'ios')) {
                tonConnectUI.openModal();
                tg.MainButton.hide();
            } else {
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
        </div>
    );
}; 