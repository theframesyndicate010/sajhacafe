import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';
import { SettingsController } from '../src/settings/settings.controller';
import { UpdateSettingsDto } from '../src/settings/dto/update-settings.dto';
import { PrismaService } from '../src/common/prisma.service';

type SettingsRow = {
  id: string;
  tenantId: string;
  businessName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  logo?: string | null;
};

/**
 * Minimal stand-in for Prisma's `upsert` on RestaurantSettings, honouring the
 * unique `tenantId` constraint that made `update` throw for tenants that had no
 * settings row yet.
 */
function prismaStub(initial: SettingsRow[] = []) {
  const rows = [...initial];
  return {
    rows,
    restaurantSettings: {
      findUniqueOrThrow: jest.fn(({ where }: { where: { tenantId: string } }) => {
        const found = rows.find((row) => row.tenantId === where.tenantId);
        if (!found) {
          const error = new Error('Record to update not found.') as Error & { code: string };
          error.code = 'P2025';
          throw error;
        }
        return found;
      }),
      upsert: jest.fn(async ({ where, create, update }: { where: { tenantId: string }; create: SettingsRow; update: Partial<SettingsRow> }) => {
        const index = rows.findIndex((row) => row.tenantId === where.tenantId);
        if (index === -1) {
          // Real rows come back with `null` for every unset nullable column.
          const created: SettingsRow = { address: null, phone: null, email: null, taxNumber: null, logo: null, ...create };
          rows.push(created);
          return created;
        }
        rows[index] = { ...rows[index], ...update };
        return rows[index];
      }),
    },
    tenant: { findUnique: jest.fn().mockResolvedValue({ name: 'Orphan Test Cafe' }) },
  };
}

const request = (tenantId: string) => ({ tenantId, userId: 'user-1', headers: {} } as Request);
const controller = (prisma: ReturnType<typeof prismaStub>) =>
  new SettingsController(prisma as unknown as PrismaService);

describe('SettingsController', () => {
  it('creates the settings row on first read for a tenant that has none', async () => {
    const prisma = prismaStub();
    const settings = await controller(prisma).get(request('tenant-1'));

    expect(settings.businessName).toBe('Orphan Test Cafe');
    expect(prisma.rows).toHaveLength(1);
  });

  it('reuses the existing row instead of creating a second one', async () => {
    const prisma = prismaStub([{ id: 'settings-1', tenantId: 'tenant-1', businessName: 'Sajha Cafe' }]);
    const settings = await controller(prisma).get(request('tenant-1'));

    expect(settings.businessName).toBe('Sajha Cafe');
    expect(prisma.rows).toHaveLength(1);
  });

  it('saves the form for a tenant that has no settings row yet', async () => {
    const prisma = prismaStub();
    await controller(prisma).update({ businessName: 'First Save Wins', address: 'Lalitpur' }, request('tenant-1'));

    expect(prisma.rows).toEqual([
      { tenantId: 'tenant-1', businessName: 'First Save Wins', address: 'Lalitpur', phone: null, email: null, taxNumber: null, logo: null },
    ]);
  });

  it('updates in place once the row exists', async () => {
    const prisma = prismaStub([{ id: 'settings-1', tenantId: 'tenant-1', businessName: 'Sajha Cafe' }]);
    const settings = await controller(prisma).update({ address: 'Durbar Marg' }, request('tenant-1'));

    expect(settings.address).toBe('Durbar Marg');
    expect(prisma.rows).toHaveLength(1);
  });

  it('falls back to the tenant name when a first save omits the cafe name', async () => {
    const prisma = prismaStub();
    const settings = await controller(prisma).update({ address: 'Patan' }, request('tenant-1'));

    expect(settings.businessName).toBe('Orphan Test Cafe');
  });

  it('rejects a logo that is not a real image', async () => {
    const prisma = prismaStub([{ id: 'settings-1', tenantId: 'tenant-1', businessName: 'Sajha Cafe' }]);

    await expect(
      controller(prisma).update({ logo: 'data:image/png;base64,notreallyapng' }, request('tenant-1')),
    ).rejects.toThrow('The uploaded file does not match its image type');
    expect(prisma.restaurantSettings.upsert).not.toHaveBeenCalled();
  });

  it('rejects an oversized logo before touching the database', async () => {
    const prisma = prismaStub([{ id: 'settings-1', tenantId: 'tenant-1', businessName: 'Sajha Cafe' }]);
    const oversized = `data:image/png;base64,${'A'.repeat(960_001)}`;

    await expect(controller(prisma).update({ logo: oversized }, request('tenant-1'))).rejects.toThrow(BadRequestException);
    expect(prisma.restaurantSettings.upsert).not.toHaveBeenCalled();
  });

  it('accepts null to clear the logo', async () => {
    const prisma = prismaStub([{ id: 'settings-1', tenantId: 'tenant-1', businessName: 'Sajha Cafe', address: 'x' }]);
    const settings = await controller(prisma).update({ logo: null }, request('tenant-1'));

    expect(settings.logo).toBeNull();
  });

  it('saves the optional tax number on a first save', async () => {
    const prisma = prismaStub();
    const settings = await controller(prisma).update({ businessName: 'Sajha Cafe', taxNumber: '601234567' }, request('tenant-1'));

    expect(settings.taxNumber).toBe('601234567');
  });

  it('updates and clears the tax number', async () => {
    const prisma = prismaStub([{ id: 'settings-1', tenantId: 'tenant-1', businessName: 'Sajha Cafe', taxNumber: '601234567' }]);

    expect((await controller(prisma).update({ taxNumber: '609999999' }, request('tenant-1'))).taxNumber).toBe('609999999');
    expect((await controller(prisma).update({ taxNumber: null }, request('tenant-1'))).taxNumber).toBeNull();
  });

  it('leaves the tax number unset when it is never supplied', async () => {
    const prisma = prismaStub();
    const settings = await controller(prisma).get(request('tenant-1'));

    expect(settings.taxNumber).toBeNull();
  });
});

/**
 * The controller tests above call methods directly, which bypasses the global
 * `ValidationPipe`. These exercise the DTO itself so the constraints are proven
 * rather than assumed.
 */
describe('UpdateSettingsDto', () => {
  const check = async (payload: Record<string, unknown>) => {
    const errors = await validate(plainToInstance(UpdateSettingsDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('treats the tax number as optional', async () => {
    expect(await check({ businessName: 'Sajha Cafe' })).toEqual([]);
    expect(await check({ businessName: 'Sajha Cafe', taxNumber: undefined })).toEqual([]);
  });

  it('accepts a tax number and an explicit null to clear it', async () => {
    expect(await check({ taxNumber: '601234567' })).toEqual([]);
    expect(await check({ taxNumber: null })).toEqual([]);
  });

  it('rejects a tax number longer than the column', async () => {
    expect(await check({ taxNumber: '9'.repeat(51) })).toContain('taxNumber must be shorter than or equal to 50 characters');
  });

  it('rejects a non-string tax number instead of letting Prisma fail on it', async () => {
    expect(await check({ taxNumber: 601234567 })).toContain('taxNumber must be a string');
  });

  it('still guards the required cafe name', async () => {
    expect(await check({ businessName: null })).toContain('businessName must be a string');
    expect(await check({ businessName: 'A'.repeat(151) })).toContain('businessName must be shorter than or equal to 150 characters');
  });
});
