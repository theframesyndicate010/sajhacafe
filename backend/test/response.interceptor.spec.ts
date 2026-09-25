import { Prisma } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';

describe('ResponseInterceptor', () => {
  it('serializes Decimal values as JSON numbers, BigInts as strings, and Dates as ISO strings', async () => {
    const interceptor = new ResponseInterceptor();
    const result = await lastValueFrom(interceptor.intercept(
      {} as never,
      { handle: () => of({ price: new Prisma.Decimal('265.50'), orderNumber: 123n, createdAt: new Date('2026-09-25T12:00:00.000Z') }) } as never,
    ));

    expect(result).toEqual({
      success: true,
      data: { price: 265.5, orderNumber: '123', createdAt: '2026-09-25T12:00:00.000Z' },
      message: 'Success',
    });
  });
});
