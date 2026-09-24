import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
@Controller('audit-logs')
@UseGuards(AuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @RequirePermission('audit.read') list(
    @Req() request: Request,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: { tenantId: request.tenantId!, ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }
}
