import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface VerifaiErrorBody {
  statusCode: number;
  errorCode: string;
  message: string | string[];
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorCode = 'INTERNAL_ERROR';
    let message: string | string[] = 'Internal server error';

    if (isHttp) {
      const r = exception.getResponse();
      if (typeof r === 'string') {
        message = r;
        errorCode = humanize(exception.constructor.name);
      } else if (typeof r === 'object' && r !== null) {
        const obj = r as Record<string, unknown>;
        message = (obj.message as string | string[]) ?? exception.message;
        errorCode =
          (obj.errorCode as string) ??
          (obj.error as string) ??
          humanize(exception.constructor.name);
      } else {
        message = exception.message;
        errorCode = humanize(exception.constructor.name);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack ?? exception.message);
    }

    const body: VerifaiErrorBody = {
      statusCode: status,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
    this.logger.warn(
      `${request.method} ${request.url} → ${status} ${errorCode}`,
    );
  }
}

function humanize(className: string): string {
  return className
    .replace(/Exception$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();
}
