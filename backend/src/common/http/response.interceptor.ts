import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(map((data) => ({ success: true, data: this.serialize(data), message: 'Success' })));
  }

  private serialize(value: unknown): unknown {
    // Prisma Decimal values are objects with enumerable implementation fields.
    // Recursing into those fields turns `Number(menu.price)` into NaN in the UI.
    if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
    if (typeof value === 'bigint') return value.toString();
    // Handle dates before generic object recursion; Object.entries(new Date()) is empty,
    // which previously returned `{}` and broke consumers expecting an ISO timestamp.
    if (value instanceof Date)
      return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
      );
    return value;
  }
}
