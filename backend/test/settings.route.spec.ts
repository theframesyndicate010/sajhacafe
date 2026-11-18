import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { AuthGuard } from '../src/auth/auth.guard';
import { PrismaService } from '../src/common/prisma.service';
import { PermissionGuard } from '../src/permissions/permission.guard';
import { SettingsController } from '../src/settings/settings.controller';

describe('SettingsController reset route', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const transaction = {
      bill: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      order: { findMany: jest.fn().mockResolvedValue([]) },
      restaurantTable: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { tenantId?: string } } }) => {
          context.switchToHttp().getRequest().tenantId = 'tenant-1';
          return true;
        },
      })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers POST /settings/reset on the settings controller', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SettingsController)).toBe('settings');
    expect(Reflect.getMetadata(PATH_METADATA, SettingsController.prototype.reset)).toBe('reset');
    expect(Reflect.getMetadata(METHOD_METADATA, SettingsController.prototype.reset)).toBe(RequestMethod.POST);
  });
});
