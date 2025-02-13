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
                showPopup: (params: {
                    title?: string;
                    message: string;
                    buttons?: Array<{
                        id?: string;
                        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
                        text?: string;
                    }>;
                }) => void;
                CloudStorage: {
                    setItem: (key: string, value: string) => Promise<void>;
                    getItem: (key: string) => Promise<string | null>;
                    removeItem: (key: string) => Promise<void>;
                };
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
        
        if (wallet) {
            await tonConnectUI.disconnect();
            localStorage.removeItem('wallet_connection');
            return;
        }

        try {
            // Modal'ı aç
            await tonConnectUI.openModal();

            // Bağlantıyı bekle
            let isConnected = false;
            let attempts = 0;
            const maxAttempts = 10;

            const checkConnection = async () => {
                while (!isConnected && attempts < maxAttempts) {
                    attempts++;
                    console.log(`Checking connection attempt ${attempts}...`);

                    const currentWallet = tonConnectUI.wallet;
                    if (currentWallet) {
                        isConnected = true;
                        console.log('Wallet connected:', currentWallet);
                        
                        // Bağlantı bilgilerini kaydet
                        localStorage.setItem('wallet_connection', JSON.stringify({
                            connected: true,
                            timestamp: Date.now()
                        }));

                        // Başarı mesajını göster
                        if (tg?.showPopup) {
                            await tg.showPopup({
                                title: 'Success',
                                message: 'Wallet connected successfully',
                                buttons: [{ type: 'ok' }]
                            });
                        }

                        // Sayfayı yenile
                        window.location.reload();
                        return;
                    }

                    // 2 saniye bekle
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                // Bağlantı başarısız olduysa hata fırlat
                if (!isConnected) {
                    throw new Error('Connection timeout');
                }
            };

            // Bağlantı kontrolünü başlat
            await checkConnection();

        } catch (error) {
            console.error('Connection error:', error);
            localStorage.removeItem('wallet_connection');
            setPaymentStatus('failed');

            // Hata mesajını göster
            if (tg?.showPopup) {
                tg.showPopup({
                    title: 'Connection Error',
                    message: 'Could not connect to wallet. Please try again.',
                    buttons: [{ type: 'ok' }]
                });
            }
        }
    };

    // Sayfa yüklendiğinde bağlantıyı kontrol et
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const stored = localStorage.getItem('wallet_connection');
                if (stored) {
                    const { connected, timestamp } = JSON.parse(stored);
                    
                    // 1 saatten eski bağlantıları temizle
                    if (Date.now() - timestamp > 3600000) {
                        localStorage.removeItem('wallet_connection');
                        return;
                    }

                    if (connected && !wallet) {
                        console.log('Restoring connection...');
                        await tonConnectUI.connectWallet();
                    }
                }
            } catch (error) {
                console.error('Connection check error:', error);
                localStorage.removeItem('wallet_connection');
            }
        };

        checkConnection();
    }, []);

    // Wallet durumu değişikliklerini izle
    useEffect(() => {
        if (!wallet) {
            console.log('Wallet disconnected');
            localStorage.removeItem('wallet_connection');
        } else {
            console.log('Wallet connected:', wallet);
            localStorage.setItem('wallet_connection', JSON.stringify({
                connected: true,
                address: wallet.account.address,
                timestamp: Date.now()
            }));
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