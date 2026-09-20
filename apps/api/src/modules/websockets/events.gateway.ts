import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { TableStatus } from "@mangiar/shared";
import type { Server, Socket } from "socket.io";
import type { AccessTokenPayload } from "../auth/types";

interface SubscribeRestaurantPayload {
  restaurantId: string;
  deviceId?: string;
}

interface UpdateTableStatusPayload {
  restaurantId: string;
  tableId: string;
  status: TableStatus;
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>("app.jwt.accessSecret"),
      });
      client.data["userId"] = payload.sub;
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe:restaurant")
  handleSubscribeRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeRestaurantPayload,
  ): void {
    void client.join(this.restaurantRoom(body.restaurantId));
  }

  @SubscribeMessage("table:update_status")
  handleTableUpdateStatus(@MessageBody() body: UpdateTableStatusPayload): void {
    this.server.to(this.restaurantRoom(body.restaurantId)).emit("table:status_changed", {
      id: body.tableId,
      status: body.status,
    });
  }

  emitOrderCreated(restaurantId: string, order: unknown): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("order:created", { order });
  }

  emitOrderUpdated(restaurantId: string, id: string, status: string): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("order:updated", { id, status });
  }

  emitOrderDeleted(restaurantId: string, id: string): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("order:deleted", { id });
  }

  emitReservationCreated(restaurantId: string, reservation: unknown): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("reservation:created", { reservation });
  }

  emitReservationUpdated(restaurantId: string, id: string, status: string): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("reservation:updated", { id, status });
  }

  emitPrintJob(restaurantId: string, printJob: unknown): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("print:job", { printJob });
  }

  emitKitchenNewItems(restaurantId: string, items: unknown): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("kitchen:new_items", { items });
  }

  emitSyncInvalidate(restaurantId: string, collections: string[]): void {
    this.server.to(this.restaurantRoom(restaurantId)).emit("sync:invalidate", { collections });
  }

  private restaurantRoom(restaurantId: string): string {
    return `restaurant:${restaurantId}`;
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth["token"] as string | undefined;
    const headerToken = client.handshake.headers.authorization?.replace("Bearer ", "");
    const token = authToken ?? headerToken;
    if (!token) {
      throw new Error("Missing auth token");
    }
    return token;
  }
}
