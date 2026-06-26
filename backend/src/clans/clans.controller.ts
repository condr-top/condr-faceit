import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request,
  UseGuards, UseInterceptors, UploadedFile, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ClansService } from './clans.service';

@Controller('clans')
@UseGuards(JwtAuthGuard)
export class ClansController {
  constructor(private clans: ClansService) {}

  // ── Аватар клана ──
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const p = join(process.cwd(), 'uploads', 'avatars');
          if (!existsSync(p)) mkdirSync(p, { recursive: true });
          cb(null, p);
        },
        filename: (req: any, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `clan_${req.user?.id || 'x'}_${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ok = ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(file.originalname).toLowerCase());
        cb(ok ? null : new BadRequestException('Только JPG, PNG, WEBP'), ok);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    return { avatarUrl: `/uploads/avatars/${file.filename}` };
  }

  // ── Литеральные пути до :id ──
  @Get('my')
  my(@Request() req: any) {
    return this.clans.getMyClan(req.user.id);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.clans.leaderboard();
  }

  @Get()
  list(
    @Query('q') q?: string,
    @Query('region') region?: string,
    @Query('language') language?: string,
    @Query('minRating') minRating?: string,
    @Query('minMembers') minMembers?: string,
    @Query('sort') sort?: 'rating' | 'members' | 'new',
  ) {
    return this.clans.listClans({
      q, region, language,
      minRating: minRating ? +minRating : undefined,
      minMembers: minMembers ? +minMembers : undefined,
      sort,
    });
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.clans.createClan(req.user.id, body);
  }

  @Post('leave')
  leave(@Request() req: any) {
    return this.clans.leave(req.user.id);
  }

  @Post('requests/:reqId/respond')
  respond(@Request() req: any, @Param('reqId', ParseIntPipe) reqId: number, @Body('accept') accept: boolean) {
    return this.clans.respondRequest(req.user.id, reqId, !!accept);
  }

  // ── Клановые бои ──
  @Post('matches')
  createChallenge(@Request() req: any, @Body() body: any) {
    return this.clans.createChallenge(req.user.id, body);
  }

  @Post('matches/:matchId/respond')
  respondChallenge(@Request() req: any, @Param('matchId', ParseIntPipe) matchId: number, @Body('accept') accept: boolean) {
    return this.clans.respondChallenge(req.user.id, matchId, !!accept);
  }

  @Post('matches/:matchId/cancel')
  cancelChallenge(@Request() req: any, @Param('matchId', ParseIntPipe) matchId: number) {
    return this.clans.cancelChallenge(req.user.id, matchId);
  }

  @Post('matches/:matchId/report')
  reportResult(@Request() req: any, @Param('matchId', ParseIntPipe) matchId: number, @Body('scoreA') scoreA: number, @Body('scoreB') scoreB: number) {
    return this.clans.reportResult(req.user.id, matchId, Number(scoreA), Number(scoreB));
  }

  // ── Сезоны ──
  @Get('seasons')
  seasons() {
    return this.clans.listSeasons();
  }

  @Get('seasons/current')
  currentSeason() {
    return this.clans.getCurrentSeason();
  }

  @Get('seasons/leaderboard')
  seasonLeaderboard() {
    return this.clans.seasonLeaderboard();
  }

  @Get('seasons/:number/results')
  seasonResults(@Param('number', ParseIntPipe) number: number) {
    return this.clans.seasonResults(number);
  }

  @Post('seasons/end')
  @UseGuards(AdminGuard)
  endSeason() {
    return this.clans.endSeason();
  }

  // ── Праки (поиск) ──
  @Get('scrims/exchange')
  exchange(@Request() req: any, @Query('region') region?: string, @Query('tier') tier?: string) {
    return this.clans.exchange(req.user.id, { region, tier });
  }

  @Get('scrims/mine')
  myListings(@Request() req: any) {
    return this.clans.myListings(req.user.id);
  }

  @Get('scrims/responses')
  myResponses(@Request() req: any) {
    return this.clans.myResponses(req.user.id);
  }

  @Post('scrims')
  createListing(@Request() req: any, @Body() body: any) {
    return this.clans.createListing(req.user.id, body);
  }

  @Post('scrims/:listingId/respond')
  respondListing(@Request() req: any, @Param('listingId', ParseIntPipe) listingId: number, @Body('map') map?: string) {
    return this.clans.respondListing(req.user.id, listingId, map);
  }

  @Post('scrims/:listingId/cancel')
  cancelListing(@Request() req: any, @Param('listingId', ParseIntPipe) listingId: number) {
    return this.clans.cancelListing(req.user.id, listingId);
  }

  @Post('scrims/responses/:responseId/accept')
  acceptResponse(@Request() req: any, @Param('responseId', ParseIntPipe) responseId: number) {
    return this.clans.acceptResponse(req.user.id, responseId);
  }

  @Post('scrims/responses/:responseId/reject')
  rejectResponse(@Request() req: any, @Param('responseId', ParseIntPipe) responseId: number) {
    return this.clans.rejectResponse(req.user.id, responseId);
  }

  // ── Календарь ──
  @Post('events')
  createEvent(@Request() req: any, @Body() body: any) {
    return this.clans.createEvent(req.user.id, Number(body.clanId), body);
  }

  @Patch('events/:eventId')
  updateEvent(@Request() req: any, @Param('eventId', ParseIntPipe) eventId: number, @Body() body: any) {
    return this.clans.updateEvent(req.user.id, eventId, body);
  }

  @Delete('events/:eventId')
  deleteEvent(@Request() req: any, @Param('eventId', ParseIntPipe) eventId: number) {
    return this.clans.deleteEvent(req.user.id, eventId);
  }

  // ── По id ──
  @Get(':id')
  get(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clans.getClan(id, req.user.id);
  }

  @Get(':id/requests')
  requests(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clans.listRequests(id, req.user.id);
  }

  @Get(':id/matches')
  matches(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clans.listMatches(req.user.id, id);
  }

  @Get(':id/history')
  history(@Param('id', ParseIntPipe) id: number, @Query('offset') offset?: string) {
    return this.clans.matchHistory(id, offset ? +offset : 0);
  }

  @Get(':id/calendar')
  calendar(@Param('id', ParseIntPipe) id: number, @Query('from') from?: string, @Query('to') to?: string) {
    return this.clans.calendar(id, from, to);
  }

  @Get(':id/season-history')
  seasonHistory(@Param('id', ParseIntPipe) id: number) {
    return this.clans.seasonHistory(id);
  }

  @Post(':id/request')
  requestJoin(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clans.requestJoin(req.user.id, id);
  }

  @Post(':id/invite')
  invite(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body('userId') userId: number) {
    return this.clans.invite(req.user.id, id, +userId);
  }

  @Post(':id/kick')
  kick(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body('userId') userId: number) {
    return this.clans.kick(req.user.id, id, +userId);
  }

  @Post(':id/officer')
  officer(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body('userId') userId: number, @Body('value') value: boolean) {
    return this.clans.setOfficer(req.user.id, id, +userId, !!value);
  }

  @Post(':id/transfer')
  transfer(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body('userId') userId: number) {
    return this.clans.transferLeadership(req.user.id, id, +userId);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.clans.updateClan(req.user.id, id, body);
  }

  @Delete(':id')
  disband(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clans.disband(req.user.id, id);
  }
}
