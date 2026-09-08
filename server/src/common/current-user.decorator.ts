import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './token.service';

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): JwtPayload => {
  return ctx.switchToHttp().getRequest().user;
});
