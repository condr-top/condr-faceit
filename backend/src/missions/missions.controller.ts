import { Controller, Get, Post, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MissionsService } from './missions.service';

@Controller('missions')
@UseGuards(JwtAuthGuard)
export class MissionsController {
  constructor(private missionsService: MissionsService) {}

  @Get()
  getMissions(@Request() req: any) {
    return this.missionsService.getUserDailyMissions(req.user.id);
  }

  @Post(':id/claim')
  claimReward(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.missionsService.claimReward(req.user.id, id);
  }

  @Post('daily-bonus')
  claimDailyBonus(@Request() req: any) {
    return this.missionsService.claimDailyBonus(req.user.id);
  }
}
