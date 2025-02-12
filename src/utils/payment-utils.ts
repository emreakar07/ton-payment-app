// Basitleştirilmiş payment utils
export const generatePaymentUrl = (params: {
    amount: string;
    orderId: string;
    productName: string;
}) => {
    const baseUrl = window.location.origin;
    const queryParams = new URLSearchParams({
        amount: params.amount,
        orderId: params.orderId,
        productName: params.productName
    });

    return `${baseUrl}?${queryParams.toString()}`;
}; 