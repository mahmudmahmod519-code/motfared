import { applyDecorators } from '@nestjs/common';
import { Column, PrimaryGeneratedColumn, PrimaryColumn, ValueTransformer } from 'typeorm';

/**
 * Ids of the rebuilt tenant domain are BIGINT UNSIGNED AUTO_INCREMENT (decision D-08) and, for the first
 * tenant, keep the legacy integer ids. MySQL hands BIGINT back as a string; ids here are far below 2^53, so
 * they are exposed as numbers (the Android contract and the legacy history use integers).
 */
export const bigintAsNumber: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | number | null) => (v === null || v === undefined ? v : Number(v)),
};

const BIGINT = { type: 'bigint', unsigned: true, transformer: bigintAsNumber } as const;

/** Auto-increment primary key; an explicit value is accepted (the importer keeps legacy ids). */
export const IdPk = () => PrimaryGeneratedColumn({ ...BIGINT } as any);
/** Primary key supplied by the caller (tables keyed by a parent id or a composite). */
export const IdPkManual = (name: string) => PrimaryColumn({ ...BIGINT, name } as any);
/** Reference to another tenant-domain row's id. */
export const IdRef = (name: string, nullable = false) => Column({ ...BIGINT, name, nullable } as any);

/** The tenant of a row: the id of a company (platform tables keep their UUID ids, decision D-20). */
export const CompanyRef = () => Column({ type: 'varchar', length: 36, name: 'company_id' });
/** Reference to a platform user (UUID). */
export const UserRef = (name: string, nullable = false) => Column({ type: 'varchar', length: 36, name, nullable });

export const Utc = (name: string, nullable = false) => Column({ type: 'datetime', precision: 3, name, nullable });
export const UtcNow = (name: string) => Column({ type: 'datetime', precision: 3, name, default: () => 'CURRENT_TIMESTAMP(3)' });

export { applyDecorators };
