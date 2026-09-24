import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { KotStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { assertTransition, KOT_TRANSITIONS } from '../common/domain/state-machine';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';

@Controller('kots')
@UseGuards(AuthGuard, PermissionGuard)
export class KotController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @RequirePermission('kitchen.manage') list(@Req() request: Request) {
    return this.prisma.kot.findMany({ where: { tenantId: request.tenantId!, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, include: { order: { include: { table: true } }, items: { include: { orderItem: true } } }, orderBy: { createdAt: 'asc' } });
  }
  @Get(':id') @RequirePermission('kitchen.manage') get(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.kot.findFirstOrThrow({ where: { id, tenantId: request.tenantId! }, include: { items: true, order: true } });
  }
  @Post(':id/start') @RequirePermission('kitchen.manage') start(@Param('id') id: string, @Req() request: Request) { return this.transition(id, 'PREPARING', request.tenantId!); }
  @Post(':id/ready') @RequirePermission('kitchen.manage') ready(@Param('id') id: string, @Req() request: Request) { return this.transition(id, 'READY', request.tenantId!); }
  @Post(':id/complete') @RequirePermission('kitchen.manage') complete(@Param('id') id: string, @Req() request: Request) { return this.transition(id, 'COMPLETED', request.tenantId!); }
  @Post(':id/cancel') @RequirePermission('kitchen.manage') cancel(@Param('id') id: string, @Body('reason') reason: string, @Req() request: Request) {
    return this.prisma.kot.updateMany({ where: { id, tenantId: request.tenantId! }, data: { status: KotStatus.CANCELLED, cancelledAt: new Date() } });
  }
  private async transition(id: string, status: KotStatus, tenantId: string) {
    const kot = await this.prisma.kot.findFirstOrThrow({ where: { id, tenantId } });
    assertTransition('KOT', kot.status, status, KOT_TRANSITIONS);
    return this.prisma.kot.updateMany({ where: { id, tenantId }, data: { status, ...(status === 'PREPARING' ? { startedAt: new Date() } : {}), ...(status === 'READY' ? { readyAt: new Date() } : {}), ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) } });
  }
}
