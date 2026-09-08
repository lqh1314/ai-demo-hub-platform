import { HttpException, HttpStatus } from '@nestjs/common';

/** 业务异常：携带稳定 code 与可选字段级 details */
export class BizException extends HttpException {
  readonly code: string;
  constructor(code: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST, details?: unknown) {
    super({ code, message, details }, status);
    this.code = code;
  }
  static notFound(msg = '资源不存在') { return new BizException('NOT_FOUND', msg, HttpStatus.NOT_FOUND); }
  static forbidden(msg = '无权操作') { return new BizException('FORBIDDEN', msg, HttpStatus.FORBIDDEN); }
  static unauthorized(msg = '未登录或登录已过期') { return new BizException('UNAUTHORIZED', msg, HttpStatus.UNAUTHORIZED); }
  static conflict(msg: string) { return new BizException('CONFLICT', msg, HttpStatus.CONFLICT); }
  static badRequest(msg: string, details?: unknown) { return new BizException('BAD_REQUEST', msg, HttpStatus.BAD_REQUEST, details); }
}
