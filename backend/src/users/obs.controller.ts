import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

/** Публичный (без авторизации) эндпоинт для OBS-виджета стримера. */
@Controller('obs')
export class ObsController {
  constructor(private usersService: UsersService) {}

  @Get(':token')
  getStats(@Param('token') token: string) {
    return this.usersService.getObsStats(token);
  }
}
