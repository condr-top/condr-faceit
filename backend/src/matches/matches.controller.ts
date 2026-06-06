import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { MatchesService } from './matches.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  // ── Active match redirect ────────────────────────────────────────────────

  @Get('my-active')
  getMyActive(@Request() req: any) {
    return this.matchesService.getMyActiveMatch(req.user.id);
  }

  // ── 2v2 Public Lobby ────────────────────────────────────────────────────

  @Get('lobby')
  getActiveLobby(@Request() req: any) {
    return this.matchesService.getActiveLobby2v2(req.user.id);
  }

  @Post('lobby/create')
  createLobby(@Request() req: any) {
    const user = req.user;
    if (user.cooldownUntil && new Date(user.cooldownUntil) > new Date()) {
      const remainMin = Math.ceil((new Date(user.cooldownUntil).getTime() - Date.now()) / 60_000);
      throw new BadRequestException(`Кулдаун активен. Осталось ~${remainMin} мин.`);
    }
    return this.matchesService.joinOrCreateLobby2v2(user.id);
  }

  @Post('lobby/join')
  joinLobby(@Request() req: any) {
    const user = req.user;
    if (user.cooldownUntil && new Date(user.cooldownUntil) > new Date()) {
      const remainMin = Math.ceil((new Date(user.cooldownUntil).getTime() - Date.now()) / 60_000);
      throw new BadRequestException(`Кулдаун активен. Осталось ~${remainMin} мин.`);
    }
    return this.matchesService.joinOrCreateLobby2v2(user.id);
  }

  @Post('lobby/leave')
  leaveLobby(@Request() req: any) {
    return this.matchesService.leaveLobby2v2(req.user.id);
  }

  @Get('history')
  getHistory(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('userId') userId?: string,
  ) {
    const targetId = userId ? +userId : req.user.id;
    return this.matchesService.getMatchHistory(targetId, +page, +limit);
  }

  @Get(':id')
  getMatch(@Param('id', ParseIntPipe) id: number) {
    return this.matchesService.fetchMatchForClient(id);
  }

  @Post(':id/ready')
  ready(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.matchesService.playerReady(id, req.user.id);
  }

  @Post(':id/expire')
  expireReadyCheck(@Param('id', ParseIntPipe) id: number) {
    return this.matchesService.expireReadyCheck(id);
  }

  @Post(':id/expire-result')
  expireResult(@Param('id', ParseIntPipe) id: number) {
    return this.matchesService.expireResult(id);
  }

  @Post(':id/veto')
  veto(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body('map') map: string,
  ) {
    return this.matchesService.vetoMap(id, req.user.id, map);
  }

  @Post(':id/screenshot')
  @UseInterceptors(FileInterceptor('screenshot', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const p = join(process.cwd(), 'uploads', 'screenshots');
        if (!existsSync(p)) mkdirSync(p, { recursive: true });
        cb(null, p);
      },
      filename: (req: any, file, cb) => {
        const ext = extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `match_${req.params.id}_${req.user.id}_${Date.now()}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
      if (!allowed.includes(extname(file.originalname).toLowerCase()))
        return cb(new BadRequestException('Только изображения'), false);
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  uploadScreenshot(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    return { url: `/uploads/screenshots/${file.filename}` };
  }

  @Post(':id/lobby-link')
  setLobbyLink(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body('link') link: string,
  ) {
    return this.matchesService.setLobbyLink(id, req.user.id, link);
  }

  @Post(':id/lobby-join')
  confirmLobbyJoin(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.matchesService.confirmLobbyJoin(id, req.user.id);
  }

  @Post(':id/result')
  submitResult(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body('scoreA') scoreA: number,
    @Body('scoreB') scoreB: number,
    @Body('screenshotUrl') screenshotUrl: string,
  ) {
    return this.matchesService.submitResult(id, req.user.id, scoreA, scoreB, screenshotUrl);
  }

  @Post(':id/confirm')
  @UseGuards(AdminGuard)
  confirmResult(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body('winner') winner: 'A' | 'B' | 'draw',
  ) {
    return this.matchesService.confirmResult(id, req.user.id, winner);
  }
}
