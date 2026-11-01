import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadItemCallCenter } from './entities/lead-item-call-center.entity';
import { LeadItemCallCentersService } from './lead-item-call-centers.service';
import { LeadItemCallCentersController } from './lead-item-call-centers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeadItemCallCenter])],
  controllers: [LeadItemCallCentersController],
  providers: [LeadItemCallCentersService],
  exports: [LeadItemCallCentersService],
})
export class LeadItemCallCentersModule {}
