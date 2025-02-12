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

    // Telegram WebApp'i başlat ve tema ayarlarını yap
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            // Mini App'i hazırla
            tg.ready();
            
            // Tam ekran yap
            tg.expand();
            
            // Kapatma onayını aktifleştir
            tg.enableClosingConfirmation();

            // Ana butonu ayarla
            tg.MainButton.text = "Connect Wallet";
            tg.MainButton.color = "#2d4052";
            tg.MainButton.textColor = "#ffffff";
            tg.MainButton.show();

            // Ana buton tıklama olayı
            tg.MainButton.onClick(() => {
                if (!wallet) {
                    tonConnectUI.openModal();
                } else {
                    handlePayment();
                }
            });

            // Tema renklerini ayarla
            if (tg.themeParams) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
                document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
                document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
                document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color);
            }
        }
    }, []);

    // Wallet durumu değiştiğinde MainButton'ı güncelle
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            if (wallet) {
                tg.MainButton.text = "Send Payment";
                tg.MainButton.color = "#66aaeee8";
            } else {
                tg.MainButton.text = "Connect Wallet";
                tg.MainButton.color = "#2d4052";
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
                    // 2 saniye sonra Mini App'i kapat
                    setTimeout(() => tg.close(), 2000);
                    break;
                case 'failed':
                    tg.MainButton.hideProgress();
                    tg.MainButton.enable();
                    break;
                default:
                    tg.MainButton.hideProgress();
                    tg.MainButton.enable();
            }
        }
    }, [paymentStatus]);

    // Transaction durumunu güncelle
    const updateTransactionStatus = async (orderId: string, txHash: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ 
                    status: 'completed',
                    transaction_hash: txHash,
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', orderId);

            if (error) throw error;
            
        } catch (error) {
            console.error('Error updating transaction status:', error);
        }
    };

    // Transaction'ı doğrula - debug logları ekleyelim
    const verifyTransaction = async (txHash: string, expectedAmount: string, expectedAddress: string, orderId: string): Promise<boolean> => {
        try {
            console.log('Starting transaction verification...', {
                txHash,
                expectedAmount,
                expectedAddress,
                orderId
            });

            // Önce Supabase'den order'ı kontrol et
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('amount, wallet_address, status')
                .eq('order_id', orderId)
                .single();

            console.log('Order data from Supabase:', { orderData, orderError });

            if (orderError || !orderData) {
                console.error('Order not found:', orderError);
                return false;
            }

            // Order zaten tamamlanmış mı kontrol et
            if (orderData.status === 'completed') {
                console.error('Order already completed');
                return false;
            }

            // Order'daki amount ve address, beklenen değerlerle eşleşiyor mu?
            if (orderData.amount !== expectedAmount || 
                orderData.wallet_address.toLowerCase() !== expectedAddress.toLowerCase()) {
                console.error('Order details do not match:', {
                    expectedAmount,
                    orderAmount: orderData.amount,
                    expectedAddress,
                    orderAddress: orderData.wallet_address
                });
                return false;
            }

            // Transaction'ı getir ve kontrol et
            console.log('Fetching transaction from TON...');
            const tx = await tonClient.getTransactions(Address.parse(expectedAddress), {
                limit: 1,
                hash: txHash
            });
            
            console.log('Transaction from TON:', tx);

            if (!tx.length) {
                console.error('Transaction not found');
                return false;
            }

            const transaction = tx[0] as unknown as TonTransaction;
            console.log('Parsed transaction:', transaction);

            // Amount ve address kontrolü
            const message = transaction.out_msgs.find((msg: TonMessage) => 
                msg.destination?.toLowerCase() === expectedAddress.toLowerCase()
            );

            if (!message) {
                console.error('No matching outgoing message found');
                return false;
            }

            const actualAmount = message.value;
            const actualAddress = message.destination || '';
            
            const expectedNano = toNano(expectedAmount).toString();
            
            // Amount ve address eşleşiyor mu?
            const isValid = actualAmount === expectedNano && 
                          actualAddress.toLowerCase() === expectedAddress.toLowerCase();

            if (!isValid) {
                console.error('Transaction verification failed:', {
                    expectedAmount: expectedNano,
                    actualAmount,
                    expectedAddress,
                    actualAddress
                });
            }

            return isValid;

        } catch (error) {
            console.error('Detailed error in verifyTransaction:', error);
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
            }
            return false;
        }
    };

    const handlePayment = async () => {
        if (!wallet || !paymentParams) return;

        try {
            const tg = window.Telegram?.WebApp;
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

            console.log('Sending transaction:', transaction);
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('Transaction result:', result);
            
            const txHash = result.boc;
            
            // Transaction doğrulama için biraz bekleyelim
            console.log('Waiting for transaction to be processed...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Transaction'ı doğrula
            const isValid = await verifyTransaction(
                txHash,
                paymentParams.amount,
                paymentParams.address,
                paymentParams.orderId
            );

            console.log('Transaction verification result:', isValid);

            if (isValid) {
                setTransactionHash(txHash);
                setPaymentStatus('success');

                // Supabase'de güncelle
                await updateTransactionStatus(paymentParams.orderId, txHash);

                // Telegram'a başarılı sonucu gönder
                if (tg) {
                    tg.sendData(JSON.stringify({
                        status: 'success',
                        orderId: paymentParams.orderId,
                        txHash: txHash,
                        amount: paymentParams.amount,
                        productName: paymentParams.productName,
                        epin: paymentParams.epin
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
                    error: error instanceof Error ? error.message : 'Unknown error occurred'
                }));
            }
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
                <h3>{paymentParams?.productName || 'Payment Details'}</h3>
                <div className="info-row">
                    <span>Amount:</span>
                    <span>{paymentParams?.amount} TON</span>
                </div>
                {paymentParams?.epin && (
                    <div className="info-row">
                        <span>E-PIN:</span>
                        <span className="comment">{paymentParams.epin}</span>
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