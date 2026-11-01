import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ name: 'role_id', length: 36 })
  role_id: string;

  @PrimaryColumn({ name: 'permission_key', length: 64 })
  permission_key: string;

  @ManyToOne(() => Role, (r) => r.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Permission, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'permission_key' })
  permission: Permission;
}
