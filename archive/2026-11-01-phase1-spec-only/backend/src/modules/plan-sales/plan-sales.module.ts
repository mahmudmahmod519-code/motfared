import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanSales } from './entities/plan-sales.entity';
import { PlanSalesService } from './plan-sales.service';
import { PlanSalesController } from './plan-sales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlanSales])],
  controllers: [PlanSalesController],
  providers: [PlanSalesService],
  exports: [PlanSalesService],
})
export class PlanSalesModule {}
