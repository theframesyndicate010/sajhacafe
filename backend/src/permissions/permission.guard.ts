import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { REQUIRED_PERMISSION } from './permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const userId = context.switchToHttp().getRequest<Request>().userId!;
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: context.switchToHttp().getRequest<Request>().tenantId!, userId } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!membership?.isActive || !membership.role.permissions.some((item) => item.permission.key === permission))
      throw new ForbiddenException('Permission denied');
    return true;
  }
}
