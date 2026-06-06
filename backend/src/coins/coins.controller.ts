import { Controller, Post, Get, Body, Param, ParseIntPipe, UseGuards, Request, Headers, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoinsService } from './coins.service';

@Controller('coins')
export class CoinsController {
  constructor(private coinsService: CoinsService) {}

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  createPurchase(
    @Request() req: any,
    @Body('rubles') rubles: number,
    @Body('payerName') payerName: string,
    @Body('bank') bank: string,
  ) {
    return this.coinsService.createPurchase(req.user.id, rubles, payerName, bank);
  }

  @Get('purchase/:id/status')
  @UseGuards(JwtAuthGuard)
  getStatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.coinsService.getPurchaseStatus(id, req.user.id);
  }

  @Post('webhook')
  handleWebhook(@Body() body: any, @Headers('x-telegram-bot-api-secret-token') secret?: string) {
    // Verify this came from Telegram (optional secret header if configured)
    const expected = process.env.WEBHOOK_SECRET;
    if (expected && secret !== expected) throw new ForbiddenException('Invalid webhook secret');
    return this.coinsService.handleWebhook(body);
  }

  @Post('setup-webhook')
  @UseGuards(JwtAuthGuard)
  setupWebhook(@Body('url') url: string) {
    return this.coinsService.setupWebhook(url);
  }
}
