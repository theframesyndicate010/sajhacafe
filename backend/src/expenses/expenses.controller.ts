import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
class ExpenseDto {
  @IsString() category!: string;
  @IsString() description!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() paymentMethod!: string;
  @IsDateString() expenseDate!: string;
}
@Controller('expenses')
@UseGuards(AuthGuard, PermissionGuard)
export class ExpensesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @RequirePermission('expenses.manage') list(@Req() request: Request) {
    return this.prisma.expense.findMany({
      where: { tenantId: request.tenantId!, isCancelled: false },
      orderBy: { expenseDate: 'desc' },
    });
  }
  @Get(':id') @RequirePermission('expenses.manage') get(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.expense.findFirstOrThrow({ where: { id, tenantId: request.tenantId! } });
  }
  @Post() @RequirePermission('expenses.manage') create(
    @Body() dto: ExpenseDto,
    @Req() request: Request,
  ) {
    return this.prisma.expense.create({
      data: { ...dto, tenantId: request.tenantId!, expenseDate: new Date(dto.expenseDate), createdBy: request.userId! },
    });
  }
  @Patch(':id') @RequirePermission('expenses.manage') update(
    @Param('id') id: string,
    @Body() dto: Partial<ExpenseDto>, @Req() request: Request,
  ) {
    return this.prisma.expense.updateMany({
      where: { id, tenantId: request.tenantId! },
      data:
        dto.amount === undefined
          ? dto
          : { ...dto, expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined },
    });
  }
  @Post(':id/cancel') @RequirePermission('expenses.manage') cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() request: Request,
  ) {
    return this.prisma.expense.updateMany({
      where: { id, tenantId: request.tenantId! },
      data: { isCancelled: true, cancelledBy: request.userId, cancellationReason: reason },
    });
  }
}
