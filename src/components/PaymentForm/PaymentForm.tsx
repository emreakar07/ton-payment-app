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
                enableClosingConfirmation: () => void;
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
                themeParams: {
                    bg_color: string;
                    text_color: string;
                    hint_color: string;
                    link_color: string;
                    button_color: string;
                    button_text_color: string;
                };
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
    const [isTelegramClient, setIsTelegramClient] = useState(false);

    // Telegram WebApp başlatma ve cüzdan bağlantısı kontrolü
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            setIsValidAccess(false);
            return;
        }

        // Telegram WebApp'i başlat
        tg.ready();
        tg.expand();
        setIsTelegramClient(true);

        // URL parametrelerini kontrol et
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const startParam = urlParams.get('start_param');
            
            if (startParam) {
                const paymentData = JSON.parse(decodeURIComponent(startParam));
                setPaymentParams(paymentData);
                setIsValidAccess(true);
            }
        } catch (error) {
            console.error('Error parsing payment data:', error);
            setIsValidAccess(false);
        }
    }, []);

    // Cüzdan bağlantı yönetimi
    const handleWalletAction = async () => {
        const tg = window.Telegram?.WebApp;
        if (wallet) {
            await tonConnectUI.disconnect();
        } else {
            try {
                // Modal'ı aç
                await tonConnectUI.openModal();
                
                // Bağlantıyı bekle
                const walletConnectionPromise = new Promise((resolve) => {
                    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
                        if (wallet) {
                            unsubscribe();
                            resolve(wallet);
                        }
                    });
                });

                // 30 saniye timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Connection timeout')), 30000);
                });

                // Bağlantıyı bekle veya timeout
                const connectedWallet = await Promise.race([
                    walletConnectionPromise,
                    timeoutPromise
                ]) as any; // Type assertion ekledik

                console.log('Wallet connected successfully:', connectedWallet);

                // Telegram'a başarılı bağlantı bilgisi gönder
                if (tg && connectedWallet) { // connectedWallet kontrolü ekledik
                    tg.sendData(JSON.stringify({
                        event: 'wallet_connected',
                        address: connectedWallet.account.address // wallet yerine connectedWallet kullanıyoruz
                    }));
                }

            } catch (error) {
                console.error('Wallet connection error:', error);
                setPaymentStatus('failed');
            }
        }
    };

    // Wallet state değişimlerini daha detaylı izle
    useEffect(() => {
        const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
            if (wallet) {
                console.log('Wallet connected:', wallet);
                // Bağlantı başarılı olduğunda UI'ı güncelle
                setPaymentStatus(null);
            } else {
                console.log('Wallet disconnected');
            }
        });

        return () => {
            unsubscribe();
        };
    }, [tonConnectUI]);

    // TonConnect UI'ın hazır olduğundan emin ol
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const wallets = await tonConnectUI.getWallets();
                console.log('Available wallets:', wallets);
                
                // Eğer önceden bağlı bir cüzdan varsa
                if (wallet) {
                    console.log('Existing wallet connection:', wallet);
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
            }
        };

        checkConnection();
    }, [tonConnectUI, wallet]);

    // Ödeme işlemi
    const handlePayment = async () => {
        if (!wallet || !paymentParams) return;

        try {
            setPaymentStatus('pending');

            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600, // 10 dakika
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

    if (!isTelegramClient) {
        return (
            <div className="payment-form">
                <div className="error-message">
                    This app can only be accessed through Telegram
                </div>
            </div>
        );
    }

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

                <div className="button-container">
                    <button 
                        className="action-button connect-button"
                        onClick={handleWalletAction}
                        disabled={paymentStatus === 'pending'}
                    >
                        {wallet ? 'Disconnect Wallet' : 'Connect Wallet'}
                    </button>

                    <button 
                        className={`action-button send-button ${!wallet ? 'disabled' : ''} ${paymentStatus === 'pending' ? 'loading' : ''}`}
                        onClick={handlePayment}
                        disabled={!wallet || paymentStatus === 'pending'}
                    >
                        {paymentStatus === 'pending' ? 'Processing...' : 'Send Transaction'}
                    </button>
                </div>
            </div>
        </div>
    );
}; 