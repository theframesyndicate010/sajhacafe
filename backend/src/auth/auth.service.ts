import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma.service';

type MembershipWithAccess = {
  id: string;
  tenantId: string;
  roleId: string;
  tenant: { id: string; name: string; slug: string };
  role: { name: string; permissions: { permission: { key: string } }[] };
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string, tenantId?: string): Promise<{ sessionId: string; user: object }> {
    email = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true, tenant: { isActive: true } },
          include: { tenant: true, role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = this.selectMembership(user.memberships, tenantId);
    const sessionId = randomBytes(32).toString('hex');
    const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 28800) * 1000;

    await this.prisma.session.create({
      data: { userId: user.id, tenantId: membership.tenantId, tokenHash: this.hash(sessionId), expiresAt: new Date(Date.now() + ttl) },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return { sessionId, user: this.safeUser(user, membership) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: this.hash(sessionId) } });
  }

  async getSessionContext(sessionId: string): Promise<{ userId: string; tenantId: string; membershipId: string; roleId: string }> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(sessionId) },
      include: { user: true, tenant: true },
    });
    if (!session || session.expiresAt < new Date() || !session.user.isActive || !session.tenant.isActive) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid session');
    }
    const membership = await this.prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId: session.tenantId, userId: session.userId } } });
    if (!membership?.isActive) throw new UnauthorizedException('Tenant access is no longer active');
    return { userId: session.userId, tenantId: session.tenantId, membershipId: membership.id, roleId: membership.roleId };
  }

  async me(userId: string, tenantId: string): Promise<object> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { where: { isActive: true, tenant: { isActive: true } }, include: { tenant: true, role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    const membership = user.memberships.find((item) => item.tenantId === tenantId);
    if (!membership) throw new UnauthorizedException('Tenant access is no longer active');
    return this.safeUser(user, membership);
  }

  tenants(userId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { userId, isActive: true, tenant: { isActive: true } },
      select: { tenant: { select: { id: true, name: true, slug: true } }, role: { select: { name: true } } },
      orderBy: { tenant: { name: 'asc' } },
    });
  }

  async switchTenant(sessionId: string, userId: string, tenantId: string) {
    if (!tenantId) throw new UnauthorizedException('Tenant is required');
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { tenant: true },
    });
    if (!membership?.isActive || !membership.tenant.isActive) throw new UnauthorizedException('Invalid tenant access');
    await this.prisma.session.update({ where: { tokenHash: this.hash(sessionId) }, data: { tenantId } });
    return this.me(userId, tenantId);
  }

  private selectMembership(memberships: MembershipWithAccess[], tenantId?: string): MembershipWithAccess {
    if (tenantId) {
      const selected = memberships.find((membership) => membership.tenantId === tenantId);
      if (!selected) throw new UnauthorizedException('Invalid tenant access');
      return selected;
    }
    if (!memberships.length) throw new UnauthorizedException('No active cafe access');
    return memberships[0];
  }

  private safeUser(user: { id: string; name: string; email: string; phone: string | null }, membership: MembershipWithAccess) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: membership.role.name,
      permissions: membership.role.permissions.map((item) => item.permission.key),
      tenant: membership.tenant,
      memberships: 'memberships' in user && Array.isArray((user as { memberships?: unknown }).memberships)
        ? (user as { memberships: { tenant: { id: string; name: string; slug: string }; role: { name: string } }[] }).memberships.map((item) => ({ tenant: item.tenant, role: item.role.name }))
        : [{ tenant: membership.tenant, role: membership.role.name }],
    };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
