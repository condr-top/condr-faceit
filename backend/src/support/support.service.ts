import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SupportMessage } from './entities/support-message.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportMessage) private msgRepo: Repository<SupportMessage>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  /** User sends a message to support */
  async sendMessage(userId: number, text: string) {
    const msg = this.msgRepo.create({ userId, text, isFromAdmin: false });
    await this.msgRepo.save(msg);
    await this.notifyAdminNewTicket(userId, text);
    return msg;
  }

  private async notifyAdminNewTicket(userId: number, text: string) {
    const botToken = process.env.BOT_TOKEN;
    const chatId   = process.env.ADMIN_CHAT_ID;
    const topicId  = process.env.TOPIC_SUPPORT ? parseInt(process.env.TOPIC_SUPPORT) : undefined;
    if (!botToken || !chatId) return;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const name = user?.gameNickname || user?.username || user?.firstName || `#${userId}`;

    // Only notify on first message (no previous messages from this user)
    const count = await this.msgRepo.count({ where: { userId, isFromAdmin: false } });

    const msgText =
      `💬 <b>Новое обращение в поддержку</b>\n\n` +
      `👤 Игрок: <b>${name}</b> (ID: ${userId})\n` +
      `💬 Сообщение: ${text.length > 200 ? text.slice(0, 200) + '...' : text}`;

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: msgText,
        parse_mode: 'HTML',
        ...(topicId ? { message_thread_id: topicId } : {}),
      });
    } catch {}
  }

  /** Get current user's chat history, mark admin messages as read */
  async getMyChat(userId: number) {
    const messages = await this.msgRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    // Mark admin replies as read by user
    const unread = messages.filter(m => m.isFromAdmin && !m.readByUser);
    if (unread.length) {
      await this.msgRepo.update(unread.map(m => m.id), { readByUser: true });
    }
    return messages;
  }

  /** Admin: get list of all unique user chats with last message + unread count */
  async getAllChats() {
    const messages = await this.msgRepo
      .createQueryBuilder('m')
      .orderBy('m.created_at', 'DESC')
      .getMany();

    const userIds = [...new Set(messages.map(m => m.userId))];
    const users = await this.userRepo.findByIds(userIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    return userIds.map(uid => {
      const userMsgs = messages.filter(m => m.userId === uid);
      const last = userMsgs[0];
      const unread = userMsgs.filter(m => !m.isFromAdmin && !m.readByAdmin).length;
      const user = userMap.get(uid);
      return {
        userId: uid,
        displayName: user?.gameNickname || user?.firstName || `User #${uid}`,
        avatarUrl: user?.avatarUrl || null,
        lastMessage: last?.text || '',
        lastAt: last?.createdAt || null,
        unread,
      };
    }).sort((a, b) => {
      // Sort by unread first, then by lastAt
      if (b.unread !== a.unread) return b.unread - a.unread;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });
  }

  /** Admin: get full chat with a specific user, mark as read */
  async getChat(userId: number) {
    const messages = await this.msgRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    // Mark user messages as read by admin
    const unread = messages.filter(m => !m.isFromAdmin && !m.readByAdmin);
    if (unread.length) {
      await this.msgRepo.update(unread.map(m => m.id), { readByAdmin: true });
    }
    return messages;
  }

  /** Admin: reply to a user */
  async adminReply(adminId: number, userId: number, text: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const msg = this.msgRepo.create({
      userId,
      text,
      isFromAdmin: true,
      adminId,
      readByAdmin: true,
    });
    await this.msgRepo.save(msg);

    // Send notification to user
    await this.notifRepo.save(
      this.notifRepo.create({
        userId,
        type: 'support_reply',
        title: '💬 Ответ поддержки',
        body: text.length > 80 ? text.slice(0, 80) + '...' : text,
        meta: { redirect: '/support' },
      }),
    );

    return msg;
  }

  /** Admin: close/clear chat with a user */
  async closeChat(userId: number) {
    await this.msgRepo.delete({ userId });
    return { ok: true };
  }

  /** Admin: total unread messages from users */
  async getUnreadCount() {
    const count = await this.msgRepo.count({
      where: { isFromAdmin: false, readByAdmin: false },
    });
    return count;
  }
}
