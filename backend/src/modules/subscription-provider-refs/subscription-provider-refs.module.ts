import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionProviderRef } from './entities/subscription-provider-ref.entity';
import { SubscriptionProviderRefsService } from './subscription-provider-refs.service';
import { SubscriptionProviderRefsController } from './subscription-provider-refs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionProviderRef])],
  controllers: [SubscriptionProviderRefsController],
  providers: [SubscriptionProviderRefsService],
  exports: [SubscriptionProviderRefsService],
})
export class SubscriptionProviderRefsModule {}
