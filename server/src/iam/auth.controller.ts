import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/auth.guard';
import { LoginDto, RefreshDto } from './dto';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/token.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Public() @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Public() @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }
  @Post('logout') logout() { return { ok: true }; }
  @Get('me') me(@CurrentUser() u: JwtPayload) { return this.auth.profile(u.sub); }
}
