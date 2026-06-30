import { Controller, Get, Post, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamesService } from './games.service';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Get('config')
  getConfig() {
    return this.gamesService.getConfig();
  }

  @Post(':game/play')
  play(@Param('game') game: string, @Request() req: any) {
    if (!['case', 'wheel', 'slots'].includes(game)) throw new BadRequestException('Unknown game');
    return this.gamesService.play(req.user.id, game as any);
  }
}
