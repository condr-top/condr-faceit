import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ModeratorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.isAdmin && !req.user?.isModerator) {
      throw new ForbiddenException('Moderator access required');
    }
    return true;
  }
}
