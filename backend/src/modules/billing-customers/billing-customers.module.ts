import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingCustomer } from './entities/billing-customer.entity';
import { BillingCustomersService } from './billing-customers.service';
import { BillingCustomersController } from './billing-customers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BillingCustomer])],
  controllers: [BillingCustomersController],
  providers: [BillingCustomersService],
  exports: [BillingCustomersService],
})
export class BillingCustomersModule {}
