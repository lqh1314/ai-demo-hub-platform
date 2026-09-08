import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

/** 统一错误体：{code,message,details,traceId}，不向客户端泄漏堆栈 */
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
