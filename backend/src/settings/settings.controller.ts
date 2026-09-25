import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
class SettingsDto {
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() taxEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() logo?: string | null;
}
@Controller('settings')
@UseGuards(AuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() get(@Req() request: Request) {
    return this.prisma.restaurantSettings.findUniqueOrThrow({ where: { tenantId: request.tenantId! } });
  }
  @Patch() @RequirePermission('users.manage') update(@Body() dto: Partial<SettingsDto>, @Req() request: Request) {
    if (dto.logo !== undefined && dto.logo !== null) {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dto.logo);
      if (!match || dto.logo.length > 960_000) throw new BadRequestException('Logo must be a PNG, JPEG, or WebP image smaller than 700 KB');
      const image = Buffer.from(match[2], 'base64');
      if (!image.length || image.length > 700 * 1024) throw new BadRequestException('Logo must be a PNG, JPEG, or WebP image smaller than 700 KB');
      const signatures = {
        png: image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        jpeg: image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff,
        webp: image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP',
      };
      if (!signatures[match[1] as keyof typeof signatures]) throw new BadRequestException('The uploaded file does not match its image type');
    }
    return this.prisma.restaurantSettings.update({ where: { tenantId: request.tenantId! }, data: dto });
  }
}
