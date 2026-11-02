import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompanyProfileService } from './company-profile.service';
import { CompanyProfileController, IndustriesController } from './company-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  providers: [CompaniesService, CompanyProfileService],
  controllers: [CompaniesController, CompanyProfileController, IndustriesController],
  exports: [CompaniesService, CompanyProfileService],
})
export class CompaniesModule {}
