import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DmService } from './dm.service';

@Controller('dm')
@UseGuards(JwtAuthGuard)
export class DmController {
  constructor(private dm: DmService) {}

  // ── Queue ──
  @Get('queue/status')
  status(@Request() req: any) { return this.dm.queueStatus(req.user.id); }

  @Post('queue/join')
  join(@Request() req: any) { return this.dm.joinQueue(req.user.id); }

  @Post('queue/leave')
  leave(@Request() req: any) { return this.dm.leaveQueue(req.user.id); }

  // ── Match ──
  @Get('match/:id')
  match(@Param('id') id: string, @Request() req: any) { return this.dm.matchState(req.user.id, id); }

  @Post('match/:id/vote')
  vote(@Param('id') id: string, @Body('map') map: string, @Request() req: any) { return this.dm.vote(req.user.id, id, map); }

  @Post('match/:id/link')
  link(@Param('id') id: string, @Body('link') link: string, @Request() req: any) { return this.dm.setLink(req.user.id, id, link); }

  @Post('match/:id/leave')
  leaveMatch(@Param('id') id: string, @Request() req: any) { return this.dm.leaveMatch(req.user.id, id); }

  // ── PRO lobbies ──
  @Get('pro')
  listPro() { return this.dm.listPro(); }

  @Post('pro')
  createPro(@Body() body: { map: string; weapons: string; condition: string; link: string }, @Request() req: any) {
    return this.dm.createPro(req.user.id, body);
  }

  @Delete('pro/:id')
  removePro(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.dm.removePro(req.user.id, id);
  }
}
