import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
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

  // ── Admin ──────────────────────────────────────────────────────────────────
  @Get('admin/catalog')
  @UseGuards(AdminGuard)
  catalog() {
    return this.achievementsService.getCatalog();
  }

  @Post('admin/grant')
  @UseGuards(AdminGuard)
  grant(@Body('userId') userId: number, @Body('key') key: string) {
    return this.achievementsService.grantAchievement(Number(userId), key);
  }
}
