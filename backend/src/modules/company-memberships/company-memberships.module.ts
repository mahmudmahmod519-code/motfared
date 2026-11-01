import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyMembership } from './entities/company-membership.entity';
import { CompanyMembershipsService } from './company-memberships.service';
import { CompanyMembershipsController } from './company-memberships.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyMembership]), RbacModule],
  controllers: [CompanyMembershipsController],
  providers: [CompanyMembershipsService],
  exports: [CompanyMembershipsService],
})
export class CompanyMembershipsModule {}
