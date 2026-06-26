import { Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CplService } from './cpl.service';

@Controller('cpl')
@UseGuards(JwtAuthGuard)
export class CplController {
  constructor(private cpl: CplService) {}

  @Get('me')
  me(@Request() req: any) { return this.cpl.myStatus(req.user.id); }

  @Get('leaderboard')
  leaderboard(@Query('league') league: string) {
    return this.cpl.seasonLeaderboard(league === 'cpl' ? 'cpl' : 'cplq');
  }

  @Get('stats')
  stats(@Query('league') league: string, @Request() req: any) {
    return this.cpl.playerLeagueStats(req.user.id, league === 'cpl' ? 'cpl' : 'cplq');
  }

  // ── Admin ──
  @Get('admin/season')
  @UseGuards(AdminGuard)
  season() { return this.cpl.getActiveSeason(); }

  @Post('admin/season/start')
  @UseGuards(AdminGuard)
  startSeason() { return this.cpl.startSeason(); }

  @Post('admin/season/stop')
  @UseGuards(AdminGuard)
  stopSeason() { return this.cpl.stopSeason(); }

  @Post('admin/recalc')
  @UseGuards(AdminGuard)
  recalc() { return this.cpl.runWeeklyRecalc(true); }
}
