import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    tenantId?: string;
    membershipId?: string;
    roleId?: string;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[process.env.SESSION_COOKIE_NAME ?? 'cafe_session'];
    if (!token) throw new UnauthorizedException('Authentication required');
    const session = await this.auth.getSessionContext(token);
    request.userId = session.userId;
    request.tenantId = session.tenantId;
    request.membershipId = session.membershipId;
    request.roleId = session.roleId;
    return true;
  }
}
