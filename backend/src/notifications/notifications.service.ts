import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private notifRepo: Repository<Notification>) {}

  async create(userId: number, type: string, title: string, body?: string, meta?: any) {
    return this.notifRepo.save(
      this.notifRepo.create({ userId, type, title, body, meta }),
    );
  }

  async getUserNotifications(userId: number) {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAllRead(userId: number) {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
    return { ok: true };
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }
}
