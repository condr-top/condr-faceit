import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ModeratorGuard } from '../auth/moderator.guard';
import { AdminService } from './admin.service';
import { ReportStatus } from '../reports/entities/report.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ── KD (moderator + admin) ────────────────────────────────────────────────

  @Get('kd/pending')
  @UseGuards(ModeratorGuard)
  getKdPending(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.getMatchesForKd(+page, +limit);
  }

  @Post('kd/:matchId')
  @UseGuards(ModeratorGuard)
  submitKd(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body('entries') entries: { userId: number; kills: number; deaths: number; assists: number }[],
    @Body('totalRounds') totalRounds?: number,
  ) {
    return this.adminService.submitKd(matchId, entries, totalRounds);
  }

  @Post('kd/:matchId/reset')
  @UseGuards(AdminGuard)
  resetKd(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.adminService.resetKd(matchId);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  @Get('stats')
  @UseGuards(AdminGuard)
  getStats() {
    return this.adminService.getStats();
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  @Get('users')
  @UseGuards(AdminGuard)
  listUsers(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.listUsers(search, +page, +limit);
  }

  @Post('users/:id/ban')
  @UseGuards(AdminGuard)
  ban(@Param('id', ParseIntPipe) id: number, @Body('reason') reason: string) {
    return this.adminService.banUser(id, reason);
  }

  @Post('users/:id/unban')
  @UseGuards(AdminGuard)
  unban(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.unbanUser(id);
  }

  @Post('users/:id/warn')
  @UseGuards(AdminGuard)
  warn(@Param('id', ParseIntPipe) id: number, @Body('reason') reason?: string) {
    return this.adminService.warnUser(id, reason);
  }

  @Post('users/:id/unwarn')
  @UseGuards(AdminGuard)
  unwarn(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.unwarnUser(id);
  }

  @Post('users/:id/leave-penalty')
  @UseGuards(AdminGuard)
  leavePenalty(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.applyLeavePenalty(id);
  }

  @Post('users/:id/reset-stats')
  @UseGuards(AdminGuard)
  resetStats(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.resetStats(id);
  }

  @Patch('users/:id/admin')
  @UseGuards(AdminGuard)
  setAdmin(@Param('id', ParseIntPipe) id: number, @Body('isAdmin') isAdmin: boolean) {
    return this.adminService.setAdmin(id, isAdmin);
  }

  @Patch('users/:id/moderator')
  @UseGuards(AdminGuard)
  setModerator(@Param('id', ParseIntPipe) id: number, @Body('isModerator') isModerator: boolean) {
    return this.adminService.setModerator(id, isModerator);
  }

  @Patch('users/:id/coins')
  @UseGuards(AdminGuard)
  adjustCoins(@Param('id', ParseIntPipe) id: number, @Body('amount') amount: number) {
    return this.adminService.adjustCoins(id, amount);
  }

  @Patch('users/:id/elo')
  @UseGuards(AdminGuard)
  setElo(@Param('id', ParseIntPipe) id: number, @Body('elo') elo: number) {
    return this.adminService.setElo(id, elo);
  }

  // ── Matches ───────────────────────────────────────────────────────────────

  @Get('matches')
  @UseGuards(AdminGuard)
  listMatches(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.adminService.listMatches(+page, +limit, status);
  }

  @Get('matches/pending-results')
  @UseGuards(AdminGuard)
  getPendingResults(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.getPendingResults(+page, +limit);
  }

  @Post('matches/:id/cancel')
  @UseGuards(AdminGuard)
  cancelMatch(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.cancelMatch(id);
  }

  @Post('matches/:id/result')
  @UseGuards(AdminGuard)
  confirmMatchResult(
    @Param('id', ParseIntPipe) id: number,
    @Body('winner') winner: 'A' | 'B' | 'draw',
  ) {
    return this.adminService.confirmMatchResult(id, winner);
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  @Get('reports')
  @UseGuards(AdminGuard)
  listReports(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 30,
  ) {
    return this.adminService.listReports(status, +page, +limit);
  }

  @Patch('reports/:id/status')
  @UseGuards(AdminGuard)
  updateReportStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: ReportStatus,
  ) {
    return this.adminService.updateReportStatus(id, status);
  }

  // ── Coin Purchases ────────────────────────────────────────────────────────

  @Get('purchases')
  @UseGuards(AdminGuard)
  listPurchases(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 30,
  ) {
    return this.adminService.listPurchases(status, +page, +limit);
  }

  @Post('purchases/:id/confirm')
  @UseGuards(AdminGuard)
  confirmPurchase(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.confirmPurchase(id);
  }

  @Post('purchases/:id/reject')
  @UseGuards(AdminGuard)
  rejectPurchase(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.rejectPurchase(id);
  }

  // ── Content creation ──────────────────────────────────────────────────────

  @Post('missions')
  @UseGuards(AdminGuard)
  createMission(@Body() body: any) {
    return this.adminService.createMission(body);
  }

  @Post('shop')
  @UseGuards(AdminGuard)
  createShopItem(@Body() body: any) {
    return this.adminService.createShopItem(body);
  }

  @Post('tournaments')
  @UseGuards(AdminGuard)
  createTournament(@Body() body: any) {
    return this.adminService.createTournament(body);
  }

  @Get('test-match/active')
  @UseGuards(AdminGuard)
  getActiveTestMatch() {
    return this.adminService.getActiveTestMatch();
  }

  @Post('test-match')
  @UseGuards(AdminGuard)
  createTestMatch(@Request() req: any) {
    return this.adminService.createTestMatch2v2(req.user.id);
  }

  @Post('test-match/join')
  @UseGuards(AdminGuard)
  joinTestMatch(@Request() req: any) {
    return this.adminService.joinTestMatch(req.user.id);
  }
}
