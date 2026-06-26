import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { tgPost } from '../common/telegram';
import { SupportMessage } from './entities/support-message.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';

const CATEGORY_LABEL: Record<string, string> = {
  payment: 'Платежи и монеты',
  account: 'Аккаунт и никнейм',
  match: 'Матчи и рейтинг',
  report: 'Жалоба на игрока',
  bug: 'Баг / ошибка',
  other: 'Другое',
};

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket) private ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportMessage) private msgRepo: Repository<SupportMessage>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  private ticketDto(t: SupportTicket) {
    return {
      id: t.id, category: t.category, categoryLabel: CATEGORY_LABEL[t.category] || 'Обращение',
      subject: t.subject, status: t.status,
      createdAt: t.createdAt, updatedAt: t.updatedAt, closedAt: t.closedAt,
    };
  }

  // ── USER ──────────────────────────────────────────────────────────────────
  async createTicket(userId: number, category: string, subject: string, text: string) {
    if (!text?.trim()) throw new BadRequestException('Опишите проблему');
    // лимит открытых тикетов — чтобы не спамили
    const openCount = await this.ticketRepo.count({ where: { userId, status: 'open' } });
    if (openCount >= 5) throw new BadRequestException('Слишком много открытых обращений (максимум 5). Дождитесь ответа.');

    const ticket = await this.ticketRepo.save(this.ticketRepo.create({
      userId,
      category: CATEGORY_LABEL[category] ? category : 'other',
      subject: (subject?.trim() || CATEGORY_LABEL[category] || 'Обращение').slice(0, 120),
      status: 'open',
    }));
    await this.msgRepo.save(this.msgRepo.create({ userId, ticketId: ticket.id, text: text.trim(), isFromAdmin: false }));
    this.notifyAdminNewTicket(userId, ticket, text).catch(() => {});
    return this.ticketDto(ticket);
  }

  async listMyTickets(userId: number) {
    const tickets = await this.ticketRepo.find({ where: { userId }, order: { updatedAt: 'DESC' } });
    if (!tickets.length) return [];
    const ids = tickets.map(t => t.id);
    const msgs = await this.msgRepo.find({ where: { ticketId: In(ids) }, order: { createdAt: 'ASC' } });
    return tickets.map(t => {
      const tm = msgs.filter(m => m.ticketId === t.id);
      const last = tm[tm.length - 1];
      const unread = tm.filter(m => m.isFromAdmin && !m.readByUser).length;
      return { ...this.ticketDto(t), lastMessage: last?.text || '', lastFromAdmin: !!last?.isFromAdmin, lastAt: last?.createdAt || t.createdAt, unread };
    }).sort((a, b) => {
      const op = (s: string) => (s === 'open' ? 0 : 1);
      if (op(a.status) !== op(b.status)) return op(a.status) - op(b.status);
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });
  }

  async getMyTicket(userId: number, ticketId: number) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, userId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    const messages = await this.msgRepo.find({ where: { ticketId }, order: { createdAt: 'ASC' } });
    const unread = messages.filter(m => m.isFromAdmin && !m.readByUser);
    if (unread.length) await this.msgRepo.update(unread.map(m => m.id), { readByUser: true });
    return { ticket: this.ticketDto(ticket), messages };
  }

  async userSendMessage(userId: number, ticketId: number, text: string) {
    if (!text?.trim()) throw new BadRequestException('Пустое сообщение');
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, userId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    if (ticket.status === 'closed') throw new BadRequestException('Тикет закрыт. Создайте новое обращение.');
    const msg = await this.msgRepo.save(this.msgRepo.create({ userId, ticketId, text: text.trim(), isFromAdmin: false }));
    ticket.updatedAt = new Date();
    await this.ticketRepo.save(ticket);
    this.notifyAdminNewTicket(userId, ticket, text, true).catch(() => {});
    return msg;
  }

  private async notifyAdminNewTicket(userId: number, ticket: SupportTicket, text: string, isReply = false) {
    const chatId = process.env.ADMIN_CHAT_ID;
    if (!process.env.BOT_TOKEN || !chatId) return;
    const topicId = process.env.TOPIC_SUPPORT ? parseInt(process.env.TOPIC_SUPPORT) : undefined;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const name = user?.gameNickname || user?.username || user?.firstName || `#${userId}`;
    const head = isReply ? '💬 <b>Новое сообщение в тикете</b>' : '🎫 <b>Новый тикет в поддержку</b>';
    const msgText =
      `${head}\n\n` +
      `👤 <b>${name}</b> (ID: ${userId})\n` +
      `📂 Тема: ${CATEGORY_LABEL[ticket.category] || ticket.category}\n` +
      `📝 ${ticket.subject}\n` +
      `💬 ${text.length > 200 ? text.slice(0, 200) + '…' : text}`;
    try {
      await tgPost('sendMessage', { chat_id: chatId, text: msgText, parse_mode: 'HTML', ...(topicId ? { message_thread_id: topicId } : {}) });
    } catch (e: any) {
      console.warn(`[support] TG send failed: ${e?.response?.data?.description || e?.message}`);
    }
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  async adminListTickets(status?: string) {
    const where = status === 'open' || status === 'closed' ? { status } : {};
    const tickets = await this.ticketRepo.find({ where, order: { updatedAt: 'DESC' }, take: 200 });
    if (!tickets.length) return [];
    const ids = tickets.map(t => t.id);
    const userIds = [...new Set(tickets.map(t => t.userId))];
    const [msgs, users] = await Promise.all([
      this.msgRepo.find({ where: { ticketId: In(ids) }, order: { createdAt: 'ASC' } }),
      this.userRepo.findBy({ id: In(userIds) }),
    ]);
    const userMap = new Map(users.map(u => [u.id, u]));
    return tickets.map(t => {
      const tm = msgs.filter(m => m.ticketId === t.id);
      const last = tm[tm.length - 1];
      const unread = tm.filter(m => !m.isFromAdmin && !m.readByAdmin).length;
      const u = userMap.get(t.userId);
      return {
        ...this.ticketDto(t),
        userId: t.userId,
        displayName: u?.gameNickname || u?.firstName || `User #${t.userId}`,
        avatarUrl: u?.avatarUrl || null,
        lastMessage: last?.text || '', lastAt: last?.createdAt || t.createdAt, unread,
      };
    }).sort((a, b) => {
      const op = (s: string) => (s === 'open' ? 0 : 1);
      if (op(a.status) !== op(b.status)) return op(a.status) - op(b.status);
      if (b.unread !== a.unread) return b.unread - a.unread;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });
  }

  async adminGetTicket(ticketId: number) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    const [messages, user] = await Promise.all([
      this.msgRepo.find({ where: { ticketId }, order: { createdAt: 'ASC' } }),
      this.userRepo.findOne({ where: { id: ticket.userId } }),
    ]);
    const unread = messages.filter(m => !m.isFromAdmin && !m.readByAdmin);
    if (unread.length) await this.msgRepo.update(unread.map(m => m.id), { readByAdmin: true });
    return {
      ticket: { ...this.ticketDto(ticket), userId: ticket.userId, displayName: user?.gameNickname || user?.firstName || `User #${ticket.userId}`, avatarUrl: user?.avatarUrl || null },
      messages,
    };
  }

  async adminReply(adminId: number, ticketId: number, text: string) {
    if (!text?.trim()) throw new BadRequestException('Пустой ответ');
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    if (ticket.status === 'closed') throw new BadRequestException('Тикет закрыт');
    const msg = await this.msgRepo.save(this.msgRepo.create({ userId: ticket.userId, ticketId, text: text.trim(), isFromAdmin: true, adminId, readByAdmin: true }));
    ticket.updatedAt = new Date();
    await this.ticketRepo.save(ticket);
    await this.notifRepo.save(this.notifRepo.create({
      userId: ticket.userId, type: 'support_reply', title: '💬 Ответ поддержки',
      body: text.length > 80 ? text.slice(0, 80) + '…' : text,
      meta: { redirect: '/support', ticketId },
    }));
    return msg;
  }

  async adminCloseTicket(adminId: number, ticketId: number) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = adminId;
    await this.ticketRepo.save(ticket);
    await this.notifRepo.save(this.notifRepo.create({
      userId: ticket.userId, type: 'support_closed', title: '✅ Обращение закрыто',
      body: `«${ticket.subject}» — закрыто поддержкой`,
      meta: { redirect: '/support', ticketId },
    }));
    return this.ticketDto(ticket);
  }

  async adminUnreadCount(): Promise<number> {
    return this.msgRepo.count({ where: { isFromAdmin: false, readByAdmin: false } });
  }
}
