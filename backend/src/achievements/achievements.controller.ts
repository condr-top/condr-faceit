import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AchievementsService } from './achievements.service';

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(private achievementsService: AchievementsService) {}

  @Get()
  getAchievements(@Request() req: any) {
    return this.achievementsService.getUserAchievements(req.user.id);
  }

  @Post(':key/claim')
  claim(@Param('key') key: string, @Request() req: any) {
    return this.achievementsService.claimAchievement(req.user.id, key);
  }
}
