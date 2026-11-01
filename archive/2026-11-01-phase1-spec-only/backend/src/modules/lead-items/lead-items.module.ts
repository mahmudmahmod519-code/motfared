import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadItem } from './entities/lead-item.entity';
import { LeadItemsService } from './lead-items.service';
import { LeadItemsController } from './lead-items.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeadItem])],
  controllers: [LeadItemsController],
  providers: [LeadItemsService],
  exports: [LeadItemsService],
})
export class LeadItemsModule {}
