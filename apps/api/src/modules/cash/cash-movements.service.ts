import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CashMovement as PrismaCashMovement } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateMovementDto } from "./dto/create-movement.dto";

@Injectable()
export class CashMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(restaurantId: string, sessionId: string): Promise<PrismaCashMovement[]> {
    await this.requireSession(restaurantId, sessionId);
    return this.prisma.cashMovement.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
  }

  async create(restaurantId: string, sessionId: string, currentUserId: string, dto: CreateMovementDto): Promise<PrismaCashMovement> {
    const session = await this.requireSession(restaurantId, sessionId);
    if (session.status !== "OPEN") {
      throw new BadRequestException("Cannot add a movement to a closed cash session");
    }

    let createdById = currentUserId;
    if (dto.createdById) {
      const staff = await this.prisma.user.findFirst({ where: { id: dto.createdById, restaurantId } });
      if (!staff) {
        throw new BadRequestException("Selected staff user not found");
      }
      createdById = dto.createdById;
    }

    return this.prisma.cashMovement.create({
      data: {
        sessionId,
        type: dto.type,
        method: dto.method,
        amount: dto.amount,
        description: dto.description,
        reference: dto.reference,
        createdById,
      },
    });
  }

  private async requireSession(restaurantId: string, sessionId: string) {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id: sessionId, cashRegister: { restaurantId } },
    });
    if (!session) {
      throw new NotFoundException("Cash session not found");
    }
    return session;
  }
}
