import { Controller, Get, Post, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  @Get()
  list() {
    return this.tournamentsService.list();
  }

  @Post(':id/register')
  register(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.tournamentsService.register(id, req.user.id);
  }

  @Get(':id/participants')
  participants(@Param('id', ParseIntPipe) id: number) {
    return this.tournamentsService.getParticipants(id);
  }
}
