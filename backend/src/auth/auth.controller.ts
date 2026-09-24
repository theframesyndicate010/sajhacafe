import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, dto.tenantId);
    response.cookie(process.env.SESSION_COOKIE_NAME ?? 'cafe_session', result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 28800) * 1000,
    });
    return result.user;
  }
  @Post('logout') @UseGuards(AuthGuard) async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[process.env.SESSION_COOKIE_NAME ?? 'cafe_session'];
    await this.auth.logout(token);
    response.clearCookie(process.env.SESSION_COOKIE_NAME ?? 'cafe_session');
    return null;
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() request: Request) {
    return this.auth.me(request.userId!, request.tenantId!);
  }

  @Get('tenants') @UseGuards(AuthGuard) tenants(@Req() request: Request) {
    return this.auth.tenants(request.userId!);
  }

  @Post('switch-tenant') @UseGuards(AuthGuard) async switchTenant(
    @Body('tenantId') tenantId: string,
    @Req() request: Request,
  ) {
    const token = request.cookies?.[process.env.SESSION_COOKIE_NAME ?? 'cafe_session'];
    return this.auth.switchTenant(token, request.userId!, tenantId);
  }
}
