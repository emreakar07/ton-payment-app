export const generatePaymentUrl = (params: {
    amount: string;
    orderId: string;
    productName: string;
    callbackUrl: string;
}) => {
    const baseUrl = 'https://your-payment-app.com';
    const queryParams = new URLSearchParams({
        amount: params.amount,
        address: 'YOUR_WALLET_ADDRESS', // Şirket cüzdan adresi
        orderId: params.orderId,
        productName: params.productName,
        callback_url: params.callbackUrl
    });

    return `${baseUrl}?${queryParams.toString()}`;
}; 