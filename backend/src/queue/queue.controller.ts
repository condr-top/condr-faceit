import { Controller, Post, Delete, Get, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueueService } from './queue.service';

@Controller('queue')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Post('join')
  async join(@Request() req: any) {
    const user = req.user;
    if (user.cooldownUntil && new Date(user.cooldownUntil) > new Date()) {
      const remainMs = new Date(user.cooldownUntil).getTime() - Date.now();
      const remainMin = Math.ceil(remainMs / 60_000);
      throw new BadRequestException(`Кулдаун активен. Осталось ~${remainMin} мин.`);
    }
    await this.queueService.joinQueue(user.id, user.elo);
    return { message: 'Joined queue', queueSize: await this.queueService.getQueueSize() };
  }

  @Delete('leave')
  async leave(@Request() req: any) {
    await this.queueService.leaveQueue(req.user.id);
    return { message: 'Left queue' };
  }

  @Get('status')
  async status(@Request() req: any) {
    const inQueue = await this.queueService.isInQueue(req.user.id);
    const queueSize = await this.queueService.getQueueSize();
    return { inQueue, queueSize };
  }
}
