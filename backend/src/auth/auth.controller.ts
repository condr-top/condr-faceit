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

  // ── Web auth ──
  /** Вебапп: сгенерировать код привязки для входа на сайте. */
  @Post('web/pair')
  @UseGuards(JwtAuthGuard)
  createWebPairing(@Request() req: any) {
    return this.authService.createWebPairing(req.user.id);
  }

  /** Сайт: погасить код привязки → JWT того же аккаунта. */
  @Post('web/redeem')
  redeemWebPairing(@Body('code') code: string) {
    return this.authService.redeemWebPairing(code);
  }

  /** Сайт: вход через Telegram Login Widget. */
  @Post('telegram-widget')
  telegramWidget(@Body() body: Record<string, any>) {
    return this.authService.telegramWidgetLogin(body);
  }
}
