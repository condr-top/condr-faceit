import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { InviteService } from './invite.service';

@Controller('invite')
@UseGuards(JwtAuthGuard)
export class InviteController {
  constructor(private inviteService: InviteService) {}

  // Текущий пригласительный код — только для админа.
  @Get('admin/current')
  @UseGuards(AdminGuard)
  current() {
    return this.inviteService.getCurrentForAdmin();
  }
}
