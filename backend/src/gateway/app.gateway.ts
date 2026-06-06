import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    // Accept both production domain and local dev
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .concat(['http://localhost:3000']),
    credentials: true,
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<number, string>();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      this.userSockets.set(payload.sub, client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.userSockets.delete(client.data.userId);
    }
  }

  @SubscribeMessage('join_match')
  handleJoinMatch(@ConnectedSocket() client: Socket, @MessageBody() matchId: number) {
    client.join(`match:${matchId}`);
  }

  @SubscribeMessage('leave_match')
  handleLeaveMatch(@ConnectedSocket() client: Socket, @MessageBody() matchId: number) {
    client.leave(`match:${matchId}`);
  }

  emitToMatch(matchId: number, event: string, data: any) {
    this.server.to(`match:${matchId}`).emit(event, data);
  }

  emitToUser(userId: number, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  emitQueueUpdate(queueSize: number) {
    this.server.emit('queue_update', { size: queueSize });
  }

  emitMatchFound(playerIds: number[], matchId: number) {
    for (const userId of playerIds) {
      this.emitToUser(userId, 'match_found', { matchId });
    }
  }
}
