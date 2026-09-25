import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Request } from 'express';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';

class CreateUserDto { @IsString() name!: string; @IsEmail() email!: string; @IsOptional() @IsString() phone?: string; @IsString() @MinLength(8) password!: string; @IsUUID() roleId!: string; }
class UpdateUserDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsEmail() email?: string; @IsOptional() @IsString() phone?: string; @IsOptional() @IsUUID() roleId?: string; }
class StatusDto { @IsBoolean() isActive!: boolean; }
class ChangePasswordDto { @IsString() @MinLength(8) password!: string; }

@Controller('users')
@UseGuards(AuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('roles') @RequirePermission('users.manage') roles() {
    return this.prisma.role.findMany({ select: { id: true, name: true, description: true }, orderBy: { name: 'asc' } });
  }
  @Get() @RequirePermission('users.manage') list(@Req() request: Request) {
    return this.prisma.user.findMany({ where: { memberships: { some: { tenantId: request.tenantId! } } }, select: { id: true, name: true, email: true, phone: true, isActive: true, memberships: { where: { tenantId: request.tenantId! }, include: { role: true } }, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }
  @Post() @RequirePermission('users.manage') async create(@Body() dto: CreateUserDto, @Req() request: Request) {
    const { roleId, password, ...userData } = dto;
    const email = userData.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) throw new ConflictException('An account with this email already exists');
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...userData, email, name: userData.name.trim(), phone: userData.phone?.trim() || null, passwordHash: await argon2.hash(password) } });
      await tx.tenantMembership.create({ data: { tenantId: request.tenantId!, userId: user.id, roleId } });
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, email: true, phone: true, isActive: true, memberships: { include: { role: true } } } });
    });
  }
  @Patch(':id') @RequirePermission('users.manage') async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() request: Request) {
    const tenantId = request.tenantId!;
    await this.assertMember(id, tenantId);
    const { roleId, email, ...profile } = dto;
    let normalizedEmail: string | undefined;
    if (email) {
      const memberships = await this.prisma.tenantMembership.count({ where: { userId: id } });
      if (memberships > 1) throw new ConflictException('This account is shared by multiple cafes; its email cannot be changed here');
      normalizedEmail = email.trim().toLowerCase();
      const duplicate = await this.prisma.user.findFirst({ where: { email: normalizedEmail, id: { not: id } } });
      if (duplicate) throw new ConflictException('An account with this email already exists');
    }
    if (roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
      if (!role) throw new NotFoundException('Role not found');
    }
    if ((profile.name !== undefined || profile.phone !== undefined) && await this.prisma.tenantMembership.count({ where: { userId: id } }) > 1)
      throw new ConflictException('This account is shared by multiple cafes; its profile cannot be changed here');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { ...profile, ...(profile.name ? { name: profile.name.trim() } : {}), ...(profile.phone !== undefined ? { phone: profile.phone.trim() || null } : {}), ...(normalizedEmail ? { email: normalizedEmail } : {}) } });
      if (roleId) await tx.tenantMembership.update({ where: { tenantId_userId: { tenantId, userId: id } }, data: { roleId } });
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, email: true, phone: true, isActive: true, memberships: { where: { tenantId }, include: { role: true } } } });
    });
  }
  @Patch(':id/status') @RequirePermission('users.manage') async status(@Param('id') id: string, @Body() dto: StatusDto, @Req() request: Request) {
    await this.assertMember(id, request.tenantId!);
    if (!dto.isActive && id === request.userId) throw new BadRequestException('You cannot deactivate your own cafe access');
    return this.prisma.tenantMembership.update({ where: { tenantId_userId: { tenantId: request.tenantId!, userId: id } }, data: { isActive: dto.isActive }, include: { role: true } });
  }
  @Delete(':id') @RequirePermission('users.manage') async deactivate(@Param('id') id: string, @Req() request: Request) {
    await this.assertMember(id, request.tenantId!);
    if (id === request.userId) throw new BadRequestException('You cannot deactivate your own cafe access');
    return this.prisma.tenantMembership.update({ where: { tenantId_userId: { tenantId: request.tenantId!, userId: id } }, data: { isActive: false } });
  }
  @Post(':id/password') @RequirePermission('users.manage') async changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto, @Req() request: Request) {
    await this.assertMember(id, request.tenantId!);
    if (await this.prisma.tenantMembership.count({ where: { userId: id } }) > 1)
      throw new ConflictException('This account is shared by multiple cafes; reset its password through the account owner');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await argon2.hash(dto.password) } });
      await tx.session.deleteMany({ where: { userId: id } });
    });
    return { success: true };
  }
  private async assertMember(userId: string, tenantId: string) {
    const membership = await this.prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!membership) throw new NotFoundException('User not found in this cafe');
  }
}
