import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get()
  getTop(@Query('limit') limit = 100) {
    return this.leaderboardService.getTopByElo(+limit);
  }

  @Get('rank')
  getMyRank(@Request() req: any) {
    return this.leaderboardService.getUserRank(req.user.id);
  }

  @Get('regional')
  getRegional(@Query('region') region: string, @Query('limit') limit = 100) {
    return this.leaderboardService.getRegionalTop(region, +limit);
  }
}
