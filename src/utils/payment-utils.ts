// Basitleştirilmiş payment utils
export const generatePaymentUrl = (params: {
    amount: string;
    orderId: string;
    productName: string;
    address: string;
}) => {
    const baseUrl = window.location.origin;
    const queryParams = new URLSearchParams({
        amount: params.amount,
        orderId: params.orderId,
        productName: params.productName,
        address: params.address
    });

    return `${baseUrl}?${queryParams.toString()}`;
}; 