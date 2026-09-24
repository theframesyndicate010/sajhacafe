import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
@WebSocketGateway({ namespace: 'socket', cors: { origin: true, credentials: true } })
export class KitchenGateway {
  @WebSocketServer() server!: Server;
  broadcast(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}
