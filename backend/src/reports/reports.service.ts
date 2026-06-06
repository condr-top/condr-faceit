import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus } from './entities/report.entity';
import { User } from '../users/entities/user.entity';
import axios from 'axios';

const REASONS: Record<string, string> = {
  cheat: '🎮 Читерство',
  insult: '🤬 Оскорбления',
  afk: '💤 АФК / саботаж',
  fake_result: '📸 Фейковый результат',
  other: '❓ Другое',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async createReport(reporterId: number, reportedId: number, reason: string, description?: string) {
    const [reporter, reported] = await Promise.all([
      this.userRepo.findOne({ where: { id: reporterId } }),
      this.userRepo.findOne({ where: { id: reportedId } }),
    ]);

    const report = await this.reportRepo.save(
      this.reportRepo.create({ reporterId, reportedId, reason, description }),
    );

    await this.sendTelegramNotification(report, reporter, reported);
    return report;
  }

  private async sendTelegramNotification(report: Report, reporter: User, reported: User) {
    const botToken = process.env.BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;
    if (!botToken || !chatId) return;

    const reporterName = reporter?.gameNickname || reporter?.username || reporter?.firstName || `#${report.reporterId}`;
    const reportedName = reported?.gameNickname || reported?.username || reported?.firstName || `#${report.reportedId}`;
    const reasonLabel = REASONS[report.reason] || report.reason;

    const text =
      `🚨 <b>Новый репорт</b>\n\n` +
      `👤 От: <b>${reporterName}</b>\n` +
      `🎯 На: <b>${reportedName}</b>\n` +
      `📋 Причина: <b>${reasonLabel}</b>\n` +
      (report.description ? `💬 Описание: ${report.description}\n` : '') +
      `🆔 ID репорта: <code>${report.id}</code>`;

    const topicId = process.env.TOPIC_REPORTS ? parseInt(process.env.TOPIC_REPORTS) : undefined;
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...(topicId ? { message_thread_id: topicId } : {}),
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Просмотрено', callback_data: `report_reviewed_${report.id}` },
            { text: '🚫 Отклонить', callback_data: `report_dismissed_${report.id}` },
          ]],
        },
      });
    } catch {}
  }

  async handleWebhookCallback(data: string) {
    if (data.startsWith('report_reviewed_')) {
      const id = parseInt(data.replace('report_reviewed_', ''));
      await this.reportRepo.update(id, { status: ReportStatus.REVIEWED });
    } else if (data.startsWith('report_dismissed_')) {
      const id = parseInt(data.replace('report_dismissed_', ''));
      await this.reportRepo.update(id, { status: ReportStatus.DISMISSED });
    }
  }

  async listReports(status?: string) {
    const where = status ? { status: status as ReportStatus } : {};
    return this.reportRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }
}
