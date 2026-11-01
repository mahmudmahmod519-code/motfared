import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualPaymentRequest } from './entities/manual-payment-request.entity';
import { PlanPrice } from '../plan-prices/entities/plan-price.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ManualPaymentRequest, PlanPrice]), SubscriptionsModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
