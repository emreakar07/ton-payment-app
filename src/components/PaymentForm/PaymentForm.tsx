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

interface ConnectedWallet {
    account: {
        address: string;
        chain: string;
        publicKey: string;
    };
    device: {
        platform: string;
        appName: string;
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

// Storage yardımcı fonksiyonları
const storage = {
    async setItem(key: string, value: any) {
        const tg = window.Telegram?.WebApp;
        if (tg?.CloudStorage) {
            try {
                await tg.CloudStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('Storage error:', error);
                // Fallback to localStorage
                localStorage.setItem(key, JSON.stringify(value));
            }
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    },

    async getItem(key: string) {
        const tg = window.Telegram?.WebApp;
        if (tg?.CloudStorage) {
            try {
                const value = await tg.CloudStorage.getItem(key);
                return value ? JSON.parse(value) : null;
            } catch (error) {
                console.error('Storage error:', error);
                // Fallback to localStorage
                return JSON.parse(localStorage.getItem(key) || 'null');
            }
        }
        return JSON.parse(localStorage.getItem(key) || 'null');
    },

    async removeItem(key: string) {
        const tg = window.Telegram?.WebApp;
        if (tg?.CloudStorage) {
            try {
                await tg.CloudStorage.removeItem(key);
            } catch (error) {
                console.error('Storage error:', error);
                localStorage.removeItem(key);
            }
        } else {
            localStorage.removeItem(key);
        }
    }
};

export const PaymentForm = () => {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null);
    const [isValidAccess, setIsValidAccess] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
    const [transactionHash, setTransactionHash] = useState<string | null>(null);
    const [isTelegramClient, setIsTelegramClient] = useState(false);

    // Bağlantı durumunu kaydet
    const saveConnectionState = async (address: string) => {
        await storage.setItem('wallet_connection', {
            connected: true,
            address: address,
            timestamp: Date.now()
        });
        console.log('Connection state saved:', address);
    };

    // Telegram WebApp başlatma ve cüzdan bağlantısı kontrolü
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            setIsValidAccess(false);
            return;
        }

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

    // Bağlantı yönetimi
    const handleWalletAction = async () => {
        const tg = window.Telegram?.WebApp;
        console.log('Current wallet state:', wallet);
        
        if (wallet) {
            console.log('Disconnecting wallet...');
            await tonConnectUI.disconnect();
            await storage.removeItem('wallet_connection');
        } else {
            try {
                console.log('Connecting wallet...');
                // Modal'ı aç
                await tonConnectUI.openModal();
                
                // Bağlantı durumunu izle
                const result = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        unsubscribe();
                        reject(new Error('Connection timeout'));
                    }, 30000);

                    const unsubscribe = tonConnectUI.onStatusChange((w) => {
                        if (w) {
                            clearTimeout(timeout);
                            unsubscribe();
                            resolve(w);
                        }
                    });
                });

                console.log('Connection successful:', result);
                
                if (result) {
                    await saveConnectionState(result.account.address);
                    
                    // Mini App'i yeniden yüklemeden önce kullanıcıya bilgi ver
                    if (tg) {
                        tg.showPopup({
                            title: 'Wallet Connected',
                            message: 'Your wallet has been connected successfully!',
                            buttons: [{
                                type: 'ok'
                            }]
                        });
                    }
                }
            } catch (error) {
                console.error('Wallet connection error:', error);
                setPaymentStatus('failed');
                await storage.removeItem('wallet_connection');
                
                if (tg) {
                    tg.showPopup({
                        title: 'Connection Error',
                        message: 'Failed to connect wallet. Please try again.',
                        buttons: [{
                            type: 'ok'
                        }]
                    });
                }
            }
        }
    };

    // Bağlantı durumunu kontrol et
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const stored = await storage.getItem('wallet_connection');
                console.log('Stored connection:', stored);
                
                if (stored?.connected && !wallet) {
                    console.log('Attempting to restore connection...');
                    await tonConnectUI.connectWallet();
                }
            } catch (error) {
                console.error('Connection check error:', error);
                await storage.removeItem('wallet_connection');
            }
        };

        checkConnection();
    }, []);

    // Wallet durumu değişikliklerini izle
    useEffect(() => {
        console.log('Wallet state changed:', wallet);
        
        if (wallet) {
            saveConnectionState(wallet.account.address);
        }
    }, [wallet]);

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