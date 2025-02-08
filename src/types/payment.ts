export type PaymentStatus = 'pending' | 'success' | 'failed';

export interface Payment {
    orderId: string;
    status: PaymentStatus;
    amount: string;
    productName: string;
    timestamp: number;
} 