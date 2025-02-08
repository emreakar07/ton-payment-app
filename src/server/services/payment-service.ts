import { Payment, PaymentStatus } from '../../types/payment';

export class PaymentService {
    private static instance: PaymentService;
    private payments: Map<string, Payment>;

    private constructor() {
        this.payments = new Map();
    }

    public static getInstance(): PaymentService {
        if (!PaymentService.instance) {
            PaymentService.instance = new PaymentService();
        }
        return PaymentService.instance;
    }

    async createPayment(payment: Omit<Payment, 'status' | 'timestamp'>): Promise<Payment> {
        const newPayment: Payment = {
            ...payment,
            status: 'pending',
            timestamp: Date.now()
        };
        
        this.payments.set(payment.orderId, newPayment);
        return newPayment;
    }

    async updatePaymentStatus(orderId: string | null, status: string | null): Promise<Payment | null> {
        if (!orderId || !status) return null;

        const payment = this.payments.get(orderId);
        if (!payment) return null;

        const updatedPayment: Payment = {
            ...payment,
            status: status as PaymentStatus
        };

        this.payments.set(orderId, updatedPayment);
        
        // Burada gerçek bir veritabanı güncellemesi yapılabilir
        console.log(`Payment ${orderId} status updated to ${status}`);
        
        return updatedPayment;
    }

    async getPayment(orderId: string): Promise<Payment | null> {
        return this.payments.get(orderId) || null;
    }
} 