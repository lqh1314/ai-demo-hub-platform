import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

/** 统一错误体：{code,message,details,traceId}，不向客户端泄漏堆栈 */
/** HTTP 状态码 -> 稳定业务 code（Nest 内置异常未自带 code 时兜底派生） */
const STATUS_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_FAILED',
  423: 'LOCKED',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const traceId = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = '服务内部错误';
    let details: unknown;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODE[status] || code;
      const r = exception.getResponse() as any;
      if (typeof r === 'string') message = r;
      else { code = r.code || code; message = r.message || message; details = r.details; }
    } else if (exception instanceof Error) {
      this.logger.error(`${traceId} ${exception.message}`, exception.stack);
      message = '服务内部错误';
    }
    if (status >= 500) this.logger.error(`${traceId} ${code} ${message}`);
    res.status(status).json({ code, message, details, traceId });
  }
}
