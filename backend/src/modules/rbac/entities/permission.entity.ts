import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Static catalogue, seeded by migration from permissions.catalogue.ts. Never written at runtime. */
@Entity('permissions')
export class Permission {
  @PrimaryColumn({ length: 64 })
  key: string;

  @Column({ name: 'group_name', length: 50 })
  group_name: string;

  @Column({ length: 255 })
  description: string;
}
