import { HttpResponseResolver } from "msw";
import { ok, badRequest } from "../utils/http-utils";
import { PaymentService } from "../services/payment-service";

export const paymentCallback: HttpResponseResolver = async ({request}) => {
    try {
        const params = new URL(request.url).searchParams;
        const status = params.get('status');
        const orderId = params.get('orderId');

        const paymentService = PaymentService.getInstance();
        const updatedPayment = await paymentService.updatePaymentStatus(orderId, status);

        if (!updatedPayment) {
            return badRequest({ error: 'Payment not found' });
        }

        return ok({ 
            success: true,
            payment: updatedPayment
        });
    } catch (e) {
        return badRequest({ error: 'Invalid request' });
    }
}; 