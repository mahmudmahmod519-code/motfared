import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Permission } from './entities/permission.entity';
import { CompanyMembership } from '../company-memberships/entities/company-membership.entity';
import { RbacService } from './rbac.service';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role, RolePermission, Permission, CompanyMembership])],
  controllers: [RolesController],
  providers: [RbacService, RolesService],
  exports: [RbacService],
})
export class RbacModule {}
