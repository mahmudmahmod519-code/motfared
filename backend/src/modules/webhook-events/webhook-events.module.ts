import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SubscriptionProviderRef } from '../subscription-provider-refs/entities/subscription-provider-ref.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookEventsController } from './webhook-events.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent, Subscription, Payment, SubscriptionProviderRef]),
    SubscriptionsModule,
  ],
  controllers: [WebhookEventsController],
  providers: [WebhookEventsService],
  exports: [WebhookEventsService],
})
export class WebhookEventsModule {}
