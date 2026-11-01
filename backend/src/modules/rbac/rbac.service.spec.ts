import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PERMISSION_KEYS, systemRole } from './permissions.catalogue';

describe('RbacService.assertCanAssign', () => {
  const rows: Record<string, string[]> = {};
  const repo: any = {
    count: jest.fn(async ({ where }: any) => (rows[where.key] ? 1 : 0)),
    findOne: jest.fn(async ({ where }: any) => (rows[where.key] ? { permissions: rows[where.key].map((permission_key) => ({ permission_key })) } : null)),
  };
  const svc = new RbacService(repo);
  const actorWith = (...permissions: string[]) => ({ id: 'a', company_id: 'c', permissions });
  const platform = { id: 'p', platform_role: 'platform_admin', permissions: [] };
  const denied = (p: Promise<any>) => expect(p).rejects.toBeInstanceOf(ForbiddenException);

  beforeEach(() => { for (const k of Object.keys(rows)) delete rows[k]; });

  it('rejects an unknown role with 400, even for a platform admin', async () => {
    await expect(svc.assertCanAssign(platform, 'c', 'nope')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.assertCanAssign(actorWith('accounts.admin'), 'c', 'nope')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('can skip the existence check when touching a membership whose role was deleted', async () => {
    await expect(svc.assertCanAssign(actorWith('accounts.admin'), 'c', 'gone', { mustExist: false })).resolves.toBeUndefined();
  });

  it('never lets a company member hand out the owner role; a platform admin may', async () => {
    await denied(svc.assertCanAssign(actorWith(...PERMISSION_KEYS), 'c', 'owner'));
    await expect(svc.assertCanAssign(platform, 'c', 'owner')).resolves.toBeUndefined();
  });

  it('the ordinary role needs accounts.manage; any other role needs accounts.admin', async () => {
    await expect(svc.assertCanAssign(actorWith('accounts.manage', 'leads.work'), 'c', 'sales')).resolves.toBeUndefined();
    await denied(svc.assertCanAssign(actorWith('leads.work'), 'c', 'sales'));
    await denied(svc.assertCanAssign(actorWith('accounts.manage', ...systemRole('team_lead')!.permissions), 'c', 'team_lead'));
    await expect(svc.assertCanAssign(actorWith('accounts.admin', ...systemRole('team_lead')!.permissions), 'c', 'team_lead')).resolves.toBeUndefined();
  });

  it('nobody grants a permission they do not hold (and the error names them)', async () => {
    rows.cashier = ['leads.work', 'billing.manage'];
    const err: any = await svc.assertCanAssign(actorWith('accounts.admin', 'leads.work'), 'c', 'cashier').catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'PERMISSION_ESCALATION', permissions: ['billing.manage'] });
  });

  it("a company override is what counts, not the system default", async () => {
    rows.sales = ['leads.work', 'billing.manage']; // this company made its sales role powerful
    await denied(svc.assertCanAssign(actorWith('accounts.manage', 'leads.work'), 'c', 'sales'));
    await expect(svc.assertCanAssign(actorWith('accounts.manage', 'leads.work', 'billing.manage'), 'c', 'sales')).resolves.toBeUndefined();
  });

  it('trusts only the permissions on the actor, not any role name', async () => {
    await denied(svc.assertCanAssign({ role: 'owner', company_id: 'c', permissions: [] }, 'c', 'sales'));
  });
});
