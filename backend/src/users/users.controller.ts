import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Request } from 'express';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';

class CreateUserDto { @IsString() name!: string; @IsEmail() email!: string; @IsOptional() @IsString() phone?: string; @IsString() @MinLength(8) password!: string; @IsUUID() roleId!: string; }
class UpdateUserDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() phone?: string; }
class StatusDto { @IsBoolean() isActive!: boolean; }
class RoleDto { @IsUUID() roleId!: string; }

@Controller('users')
@UseGuards(AuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @RequirePermission('users.manage') list(@Req() request: Request) {
    return this.prisma.user.findMany({ where: { memberships: { some: { tenantId: request.tenantId!, isActive: true } } }, select: { id: true, name: true, email: true, phone: true, isActive: true, memberships: { where: { tenantId: request.tenantId!, isActive: true }, include: { role: true } }, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }
  @Post() @RequirePermission('users.manage') async create(@Body() dto: CreateUserDto, @Req() request: Request) {
    const { roleId, password, ...userData } = dto;
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...userData, passwordHash: await argon2.hash(password) } });
      await tx.tenantMembership.create({ data: { tenantId: request.tenantId!, userId: user.id, roleId } });
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, email: true, phone: true, isActive: true, memberships: { include: { role: true } } } });
    });
  }
  @Patch(':id') @RequirePermission('users.manage') async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() request: Request) {
    await this.assertMember(id, request.tenantId!);
    return this.prisma.user.update({ where: { id }, data: { ...dto }, select: { id: true, name: true, email: true, phone: true, isActive: true, memberships: { where: { tenantId: request.tenantId!, isActive: true }, include: { role: true } } } });
  }
  @Patch(':id/status') @RequirePermission('users.manage') async status(@Param('id') id: string, @Body() dto: StatusDto, @Req() request: Request) {
    await this.assertMember(id, request.tenantId!);
    return this.prisma.user.update({ where: { id }, data: { isActive: dto.isActive }, select: { id: true, isActive: true } });
  }
  @Patch(':id/role') @RequirePermission('users.manage') async role(@Param('id') id: string, @Body() dto: RoleDto, @Req() request: Request) {
    await this.assertMember(id, request.tenantId!);
    return this.prisma.tenantMembership.update({ where: { tenantId_userId: { tenantId: request.tenantId!, userId: id } }, data: { roleId: dto.roleId }, select: { id: true, role: true } });
  }
  private async assertMember(userId: string, tenantId: string) {
    const membership = await this.prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!membership?.isActive) throw new NotFoundException('User not found in this cafe');
  }
}
