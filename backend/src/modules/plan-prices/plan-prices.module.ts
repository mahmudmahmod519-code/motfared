import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanPrice } from './entities/plan-price.entity';
import { PlanPricesService } from './plan-prices.service';
import { PlanPricesController } from './plan-prices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlanPrice])],
  controllers: [PlanPricesController],
  providers: [PlanPricesService],
  exports: [PlanPricesService],
})
export class PlanPricesModule {}
