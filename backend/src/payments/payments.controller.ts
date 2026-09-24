import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { PaymentDto, SplitPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments')
  @RequirePermission('payments.read')
  list(@Req() request: Request) {
    return this.payments.list(request.tenantId!);
  }

  @Get('payments/:id')
  @RequirePermission('payments.read')
  get(@Param('id') id: string, @Req() request: Request) {
    return this.payments.getById(id, request.tenantId!);
  }

  @Post('orders/:id/payments')
  @RequirePermission('payments.create')
  create(@Param('id') id: string, @Body() dto: PaymentDto, @Req() request: Request) {
    return this.payments.create(id, dto, request);
  }

  @Post('orders/:id/payments/split')
  @RequirePermission('payments.create')
  createSplit(@Param('id') id: string, @Body() dto: SplitPaymentDto, @Req() request: Request) {
    return this.payments.createSplit(id, dto.payments, request);
  }

  @Post('payments/:id/refund')
  @RequirePermission('payments.refund')
  refund(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
    @Req() request: Request,
  ) {
    return this.payments.refund(id, amount, reason, request);
  }
}
