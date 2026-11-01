import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PlanPricesService } from './plan-prices.service';
import { CreatePlanPriceDto } from './dto/create-plan-price.dto';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('plan-prices')
export class PlanPricesController {
  constructor(private readonly service: PlanPricesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  create(@Body() dto: CreatePlanPriceDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('plan_id') planId?: string) {
    return this.service.findAll(planId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  update(@Param('id') id: string, @Body() dto: UpdatePlanPriceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
