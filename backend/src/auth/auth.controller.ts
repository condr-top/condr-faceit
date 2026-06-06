import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('telegram')
  async telegramAuth(@Body('initData') initData: string) {
    const user = await this.authService.validateTelegramInitData(initData);
    return this.authService.login(user);
  }

  // DEV ENDPOINT DISABLED — security risk
  // @Post('dev')
  // async devAuth(@Body('telegramId') telegramId: number) {
  //   return this.authService.loginDev(telegramId);
  // }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req: any) {
    return req.user;
  }
}
