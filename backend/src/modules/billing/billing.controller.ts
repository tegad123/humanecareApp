import {
  Controller,
  Get,
  Post,
  Headers,
  RawBody,
  HttpCode,
} from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { Roles, CurrentUser, Public } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  @Roles('super_admin', 'admin')
  getSubscription(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.billingService.getSubscription(authUser.organizationId);
  }

  @Post('checkout-session')
  @Roles('super_admin', 'admin')
  createCheckoutSession(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.billingService.createCheckoutSession(
      authUser.organizationId,
      authUser.email,
    );
  }

  @Post('portal-session')
  @Roles('super_admin', 'admin')
  createPortalSession(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.billingService.createPortalSession(authUser.organizationId);
  }

  @Get('invoices')
  @Roles('super_admin', 'admin')
  listInvoices(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.billingService.listInvoices(authUser.organizationId);
  }

  @Get('payment-methods')
  @Roles('super_admin', 'admin')
  listPaymentMethods(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.billingService.listPaymentMethods(authUser.organizationId);
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.billingService.handleWebhookEvent(rawBody, signature);
  }
}
