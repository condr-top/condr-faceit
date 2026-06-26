import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private supportService: SupportService) {}

  // ── USER: tickets ──────────────────────────────────────────────────────────
  @Post('tickets')
  createTicket(@Request() req: any, @Body('category') category: string, @Body('subject') subject: string, @Body('text') text: string) {
    return this.supportService.createTicket(req.user.id, category, subject, text);
  }

  @Get('tickets')
  myTickets(@Request() req: any) {
    return this.supportService.listMyTickets(req.user.id);
  }

  @Get('tickets/:id')
  myTicket(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.supportService.getMyTicket(req.user.id, id);
  }

  @Post('tickets/:id/message')
  sendMessage(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body('text') text: string) {
    return this.supportService.userSendMessage(req.user.id, id, text);
  }

  // ── ADMIN: tickets ─────────────────────────────────────────────────────────
  @Get('admin/tickets')
  @UseGuards(AdminGuard)
  adminTickets(@Query('status') status?: string) {
    return this.supportService.adminListTickets(status);
  }

  @Get('admin/unread')
  @UseGuards(AdminGuard)
  adminUnread() {
    return this.supportService.adminUnreadCount();
  }

  @Get('admin/tickets/:id')
  @UseGuards(AdminGuard)
  adminTicket(@Param('id', ParseIntPipe) id: number) {
    return this.supportService.adminGetTicket(id);
  }

  @Post('admin/tickets/:id/reply')
  @UseGuards(AdminGuard)
  adminReply(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body('text') text: string) {
    return this.supportService.adminReply(req.user.id, id, text);
  }

  @Post('admin/tickets/:id/close')
  @UseGuards(AdminGuard)
  adminClose(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.supportService.adminCloseTicket(req.user.id, id);
  }
}
