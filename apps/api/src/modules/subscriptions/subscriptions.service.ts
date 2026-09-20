import { Injectable } from "@nestjs/common";
import type { Module as ModuleEnum } from "@mangiar/shared";
import type { Module as PrismaModule } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveModules(restaurantId: string): Promise<ModuleEnum[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        restaurantId,
        status: { in: ["TRIAL", "ACTIVE"] },
      },
      select: { module: true },
    });
    return subscriptions.map((subscription) => subscription.module as ModuleEnum);
  }

  async createTrialSubscription(restaurantId: string, module: ModuleEnum, trialDays = 14): Promise<void> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    await this.prisma.subscription.create({
      data: {
        restaurantId,
        module: module as unknown as PrismaModule,
        status: "TRIAL",
        trialEndsAt,
      },
    });
  }
}
