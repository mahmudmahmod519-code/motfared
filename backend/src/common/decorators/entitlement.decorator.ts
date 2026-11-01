import { SetMetadata } from '@nestjs/common';

export const ENTITLEMENT_KEY = 'entitlement';
/** `always`: reachable in every state (status endpoints) but still company-scoped. */
export type EntitlementRequirement = 'read' | 'write' | 'billing' | 'always';

/** Overrides the default (GET/HEAD → read, everything else → write). */
export const Entitlement = (requirement: EntitlementRequirement) => SetMetadata(ENTITLEMENT_KEY, requirement);
