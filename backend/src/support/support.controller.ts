import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private supportService: SupportService) {}

  /** User: send message to support */
  @Post('message')
  sendMessage(@Request() req: any, @Body('text') text: string) {
    return this.supportService.sendMessage(req.user.id, text);
  }

  /** User: get own chat history */
  @Get('messages')
  getMyChat(@Request() req: any) {
    return this.supportService.getMyChat(req.user.id);
  }

  /** Admin: get all chats list */
  @Get('admin/chats')
  @UseGuards(AdminGuard)
  getAllChats() {
    return this.supportService.getAllChats();
  }

  /** Admin: unread count */
  @Get('admin/unread')
  @UseGuards(AdminGuard)
  getUnread() {
    return this.supportService.getUnreadCount();
  }

  /** Admin: get chat with specific user */
  @Get('admin/chats/:userId')
  @UseGuards(AdminGuard)
  getChat(@Param('userId', ParseIntPipe) userId: number) {
    return this.supportService.getChat(userId);
  }

  /** Admin: close/clear chat */
  @Delete('admin/chats/:userId')
  @UseGuards(AdminGuard)
  closeChat(@Param('userId', ParseIntPipe) userId: number) {
    return this.supportService.closeChat(userId);
  }

  /** Admin: reply to user */
  @Post('admin/reply')
  @UseGuards(AdminGuard)
  adminReply(
    @Request() req: any,
    @Body('userId') userId: number,
    @Body('text') text: string,
  ) {
    return this.supportService.adminReply(req.user.id, userId, text);
  }
}
