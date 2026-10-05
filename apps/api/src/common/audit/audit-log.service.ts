import { Injectable } from "@nestjs/common";
import { AuditAction } from "@mangiar/shared";
import type { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

interface RecordAuditLogInput {
  restaurantId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        actorId: input.actorId ?? undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
