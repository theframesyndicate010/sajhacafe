import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { InvalidTransitionError } from '../domain/state-machine';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof InvalidTransitionError) status = HttpStatus.CONFLICT;
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') status = HttpStatus.CONFLICT;
      if (exception.code === 'P2003') status = HttpStatus.BAD_REQUEST;
      if (exception.code === 'P2025') status = HttpStatus.NOT_FOUND;
      if (exception.code === 'P2000') status = HttpStatus.BAD_REQUEST;
      this.logger.error(`Database request failed (${exception.code}): ${exception.message}`, exception.stack);
    } else if (exception instanceof InvalidTransitionError) {
      this.logger.warn(exception.message);
    } else if (!(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    } else if (status >= 500) {
      this.logger.error(exception.stack ?? exception.message);
    }
    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Prisma.PrismaClientKnownRequestError
          ? { message: this.prismaMessage(exception.code) }
          : { message: 'Internal server error' };
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string }).message ?? 'Request failed';
    const userMessage = status === HttpStatus.FORBIDDEN
      ? 'You do not have permission to perform this action.'
      : exception instanceof InvalidTransitionError
        ? 'This record can no longer be moved to that status.'
      : status === HttpStatus.CONFLICT && exception instanceof Prisma.PrismaClientKnownRequestError
        ? 'This record conflicts with existing data.'
        : message;
    response.status(status).json({ success: false, error: { code: this.code(status), message: userMessage } });
  }

  /**
   * Turns a Prisma error code into an actionable message. The raw Prisma text
   * is deliberately not forwarded: it can name columns and constraints, and a
   * bare "Internal server error" on a 404 is actively misleading.
   */
  private prismaMessage(code: string): string {
    return (
      {
        P2000: 'One of the values is longer than the field allows.',
        P2002: 'This record conflicts with existing data.',
        P2003: 'A related record is missing.',
        P2025: 'The requested record was not found.',
      } as Record<string, string>
    )[code] ?? 'The database could not complete this request.';
  }

  private code(status: number): string {
    return (
      (
        {
          400: 'VALIDATION_ERROR',
          401: 'UNAUTHORIZED',
          403: 'FORBIDDEN',
          404: 'RESOURCE_NOT_FOUND',
          409: 'CONFLICT',
          422: 'UNPROCESSABLE_ENTITY',
        } as Record<number, string>
      )[status] ?? 'INTERNAL_ERROR'
    );
  }
}
