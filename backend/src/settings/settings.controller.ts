import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const MAX_LOGO_BYTES = 700 * 1024;
const MAX_LOGO_DATA_URL = 960_000;

@Controller('settings')
@UseGuards(AuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A cafe always has settings, so the row is created on first read instead of
   * being assumed to exist. Tenants created outside `scripts/seed-admin.ts`
   * previously had no row, which made this endpoint 404 and left the setup form
   * unable to save because the matching `update` had nothing to update.
   */
  @Get()
  async get(@Req() request: Request) {
    const tenantId = request.tenantId!;
    return this.prisma.restaurantSettings.upsert({
      where: { tenantId },
      create: { tenantId, businessName: await this.fallbackName(tenantId) },
      update: {},
    });
  }

  @Patch()
  @RequirePermission('users.manage')
  async update(@Body() dto: UpdateSettingsDto, @Req() request: Request) {
    this.assertValidLogo(dto.logo);
    const tenantId = request.tenantId!;
    return this.prisma.restaurantSettings.upsert({
      where: { tenantId },
      // Spread first so the required columns below always win over the payload.
      create: { ...dto, tenantId, businessName: dto.businessName ?? (await this.fallbackName(tenantId)) },
      update: dto,
    });
  }

  private async fallbackName(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return tenant?.name ?? 'Cafe';
  }

  private assertValidLogo(logo?: string | null): void {
    if (logo === undefined || logo === null) return;
    const invalid = 'Logo must be a PNG, JPEG, or WebP image smaller than 700 KB';
    if (logo.length > MAX_LOGO_DATA_URL) throw new BadRequestException(invalid);
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo);
    if (!match) throw new BadRequestException(invalid);
    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > MAX_LOGO_BYTES) throw new BadRequestException(invalid);
    const signatures = {
      png: image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      jpeg: image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff,
      webp: image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP',
    };
    if (!signatures[match[1] as keyof typeof signatures]) throw new BadRequestException('The uploaded file does not match its image type');
  }
}
