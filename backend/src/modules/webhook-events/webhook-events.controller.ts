import {
  Controller, Post, Get, Req, Query, Headers, HttpCode, UseGuards,
  UnauthorizedException, ServiceUnavailableException, BadRequestException, RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import Stripe from 'stripe';
import { WebhookEventsService } from './webhook-events.service';
import { verifyPaymobHmac } from './paymob-hmac';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { configuredSecret } from '../../common/config/secrets';

const STRIPE_TOLERANCE_SECONDS = 300;

@Controller('webhooks')
export class WebhookEventsController {
  // Signature verification only needs the library's crypto helpers; no API key or network call.
  private readonly stripe = new Stripe('sk_unused_for_webhook_verification');

  constructor(
    private readonly service: WebhookEventsService,
    private readonly config: ConfigService,
  ) {}

  /** The raw bytes Stripe signed (needs `rawBody: true` at bootstrap). Never the re-serialised JSON. */
  @Post('stripe')
  @HttpCode(200)
  @SkipThrottle()
  async handleStripe(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    const secret = configuredSecret(this.config.get<string>('STRIPE_WEBHOOK_SECRET'));
    if (!secret) throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    if (!signature || !req.rawBody) throw new UnauthorizedException('Missing webhook signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, secret, STRIPE_TOLERANCE_SECONDS);
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.service.handleStripeEvent(event);
  }

  @Post('paymob')
  @HttpCode(200)
  @SkipThrottle()
  async handlePaymob(@Req() req: Request, @Query('hmac') hmac?: string) {
    const secret = configuredSecret(this.config.get<string>('PAYMOB_HMAC_SECRET'));
    if (!secret) throw new ServiceUnavailableException('Paymob HMAC secret is not configured');
    const obj = (req.body as any)?.obj;
    if (!verifyPaymobHmac(obj, hmac, secret)) throw new UnauthorizedException('Invalid webhook signature');
    if (obj.id == null) throw new BadRequestException('Missing transaction id');
    return this.service.handlePaymobEvent(obj);
  }

  @Get('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  findAll() {
    return this.service.findAll();
  }
}
