import { Controller, Get, Post, Delete, Body, UseGuards, Request, Param, ParseIntPipe, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Post('mini-game/claim')
  claimMiniGame(@Request() req: any) {
    return this.usersService.claimMiniGameReward(req.user.id);
  }

  @Get('stream-token')
  getStreamToken(@Request() req: any) {
    return this.usersService.getStreamToken(req.user.id);
  }

  @Post('stream-token/regenerate')
  regenerateStreamToken(@Request() req: any) {
    return this.usersService.regenerateStreamToken(req.user.id);
  }

  @Post('privacy')
  updatePrivacy(@Request() req: any, @Body('hideUsername') hideUsername: boolean) {
    return this.usersService.updatePrivacy(req.user.id, hideUsername);
  }

  @Post('notif-prefs')
  updateNotifPrefs(@Request() req: any, @Body('prefs') prefs: Record<string, boolean>) {
    return this.usersService.updateNotifPrefs(req.user.id, prefs);
  }

  @Post('discord')
  setDiscord(@Request() req: any, @Body('discordUsername') name: string) {
    return this.usersService.setDiscordUsername(req.user.id, name ?? null);
  }

  @Post('region')
  async updateRegion(@Request() req: any, @Body('region') region: string) {
    try {
      return await this.usersService.updateRegion(req.user.id, region ?? null);
    } catch (e: any) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException(e.message);
    }
  }

  @Post('invite/redeem')
  redeemInvite(@Request() req: any, @Body('code') code: string) {
    return this.usersService.redeemInvite(req.user.id, code);
  }

  @Post('register')
  register(
    @Request() req: any,
    @Body('gameNickname') gameNickname: string,
    @Body('gameId') gameId: string,
    @Body('deviceSerial') deviceSerial: string,
    @Body('region') region: string,
  ) {
    return this.usersService.register(req.user.id, gameNickname, gameId, deviceSerial, region);
  }

  @Post('change-nickname')
  changeNickname(@Request() req: any, @Body('nickname') nickname: string) {
    return this.usersService.changeNickname(req.user.id, nickname);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads', 'avatars');
          if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req: any, file, cb) => {
          const userId = req.user?.id || 'unknown';
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `avatar_${userId}_${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Только JPG, PNG, WEBP'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.usersService.updateAvatar(req.user.id, avatarUrl);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  search(@Query('q') q: string) {
    return this.usersService.searchByGameId(q);
  }

  @Get('batch')
  @UseGuards(JwtAuthGuard)
  batch(@Query('ids') ids: string) {
    const parsed = (ids || '').split(',').map(Number).filter(Boolean).slice(0, 50); // max 50 IDs
    return this.usersService.getBatch(parsed);
  }

  @Get('friends')
  getFriends(@Request() req: any) {
    return this.usersService.getFriends(req.user.id);
  }

  @Get('friends/requests')
  getFriendRequests(@Request() req: any) {
    return this.usersService.getFriendRequests(req.user.id);
  }

  @Post(':id/friend/request')
  sendRequest(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.sendFriendRequest(req.user.id, id);
  }

  @Post(':id/friend/accept')
  acceptRequest(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.acceptFriendRequest(req.user.id, id);
  }

  @Delete(':id/friend')
  removeFriend(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.removeFriend(req.user.id, id);
  }

  // ── "me" routes must come BEFORE :id routes to avoid param conflict ──

  @Get('me/elo-history')
  getMyEloHistory(@Request() req: any) {
    return this.usersService.getEloHistory(req.user.id);
  }

  @Get(':id/rank')
  getUserRank(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserRank(id);
  }

  @Get(':id/public')
  getPublicProfile(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.usersService.getPublicProfile(id, req.user.id);
  }

  @Get(':id/elo-history')
  getEloHistory(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getEloHistory(id);
  }
}
