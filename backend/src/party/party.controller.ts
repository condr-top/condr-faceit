import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartyService } from './party.service';

@Controller('party')
@UseGuards(JwtAuthGuard)
export class PartyController {
  constructor(private partyService: PartyService) {}

  @Get()
  getState(@Request() req: any) {
    return this.partyService.getState(req.user.id);
  }

  @Post('invite')
  invite(@Body('userId') userId: number, @Request() req: any) {
    return this.partyService.invite(req.user.id, Number(userId));
  }

  @Post('accept')
  accept(@Body('partyId') partyId: string, @Request() req: any) {
    return this.partyService.accept(req.user.id, partyId);
  }

  @Post('decline')
  decline(@Body('partyId') partyId: string, @Request() req: any) {
    return this.partyService.decline(req.user.id, partyId);
  }

  @Post('leave')
  leave(@Request() req: any) {
    return this.partyService.leave(req.user.id);
  }

  @Post('kick')
  kick(@Body('userId') userId: number, @Request() req: any) {
    return this.partyService.kick(req.user.id, Number(userId));
  }

  @Post('cancel-invite')
  cancelInvite(@Body('userId') userId: number, @Request() req: any) {
    return this.partyService.cancelInvite(req.user.id, Number(userId));
  }

  @Post('queue')
  queue(@Request() req: any) {
    return this.partyService.queue(req.user.id);
  }
}
