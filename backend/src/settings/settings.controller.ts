import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
class SettingsDto {
  @IsString() businessName!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() taxEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsString() timezone?: string;
}
@Controller('settings')
@UseGuards(AuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @RequirePermission('reports.read') get(@Req() request: Request) {
    return this.prisma.restaurantSettings.findUniqueOrThrow({ where: { tenantId: request.tenantId! } });
  }
  @Patch() @RequirePermission('users.manage') update(@Body() dto: Partial<SettingsDto>, @Req() request: Request) {
    return this.prisma.restaurantSettings.update({ where: { tenantId: request.tenantId! }, data: dto });
  }
}
