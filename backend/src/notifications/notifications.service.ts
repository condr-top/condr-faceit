import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Notification } from './entities/notification.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const cutoff = () => new Date(Date.now() - DAY_MS); // уведомления храним 24 часа

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private notifRepo: Repository<Notification>) {}

  async create(userId: number, type: string, title: string, body?: string, meta?: any) {
    return this.notifRepo.save(
      this.notifRepo.create({ userId, type, title, body, meta }),
    );
  }

  async getUserNotifications(userId: number) {
    // Чистим всё старше 24ч и отдаём только свежие
    await this.notifRepo.delete({ userId, createdAt: LessThan(cutoff()) });
    return this.notifRepo.find({
      where: { userId, createdAt: MoreThan(cutoff()) },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async deleteOne(userId: number, id: number) {
    await this.notifRepo.delete({ id, userId });
    return { ok: true };
  }

  async markAllRead(userId: number) {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
    return { ok: true };
  }

  async getUnreadCount(userId: number): Promise<number> {
    // Непрочитанные только за последние 24ч
    return this.notifRepo.count({ where: { userId, isRead: false, createdAt: MoreThan(cutoff()) } });
  }
}
