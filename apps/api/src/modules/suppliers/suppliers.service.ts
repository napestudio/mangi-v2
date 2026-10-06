import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Supplier as PrismaSupplier,
  SupplierLedgerEntry as PrismaSupplierLedgerEntry,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateSupplierDto } from "./dto/create-supplier.dto";
import type { LinkIngredientDto } from "./dto/link-ingredient.dto";
import type { RecordPaymentDto } from "./dto/record-payment.dto";
import type { UpdateSupplierDto } from "./dto/update-supplier.dto";

const SUPPLIER_INCLUDE = {
  ingredients: { include: { ingredient: true } },
  ledgerEntries: {
    orderBy: { createdAt: "desc" as const },
    include: { createdBy: { select: { id: true, name: true, username: true } } },
  },
} as const;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string) {
    return this.prisma.supplier.findMany({
      where: { restaurantId },
      include: { ingredients: { include: { ingredient: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, restaurantId }, include: SUPPLIER_INCLUDE });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
    return supplier;
  }

  create(restaurantId: string, dto: CreateSupplierDto): Promise<PrismaSupplier> {
    return this.prisma.supplier.create({ data: { ...dto, restaurantId } });
  }

  async update(restaurantId: string, id: string, dto: UpdateSupplierDto): Promise<PrismaSupplier> {
    await this.requireSupplier(restaurantId, id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.requireSupplier(restaurantId, id);
    await this.prisma.supplier.delete({ where: { id } });
  }

  async linkIngredient(restaurantId: string, supplierId: string, dto: LinkIngredientDto) {
    await this.requireSupplier(restaurantId, supplierId);
    const ingredient = await this.prisma.ingredient.findFirst({ where: { id: dto.ingredientId, restaurantId } });
    if (!ingredient) {
      throw new BadRequestException("Ingredient not found");
    }

    return this.prisma.ingredientSupplier.upsert({
      where: { ingredientId_supplierId: { ingredientId: dto.ingredientId, supplierId } },
      create: {
        ingredientId: dto.ingredientId,
        supplierId,
        supplierSku: dto.supplierSku,
        lastCost: dto.lastCost,
        isPreferred: dto.isPreferred ?? false,
      },
      update: { supplierSku: dto.supplierSku, lastCost: dto.lastCost, isPreferred: dto.isPreferred },
      include: { ingredient: true },
    });
  }

  async unlinkIngredient(restaurantId: string, supplierId: string, ingredientId: string): Promise<void> {
    await this.requireSupplier(restaurantId, supplierId);
    await this.prisma.ingredientSupplier.deleteMany({ where: { supplierId, ingredientId } });
  }

  async recordPayment(
    restaurantId: string,
    supplierId: string,
    currentUserId: string,
    dto: RecordPaymentDto,
  ): Promise<PrismaSupplierLedgerEntry> {
    await this.requireSupplier(restaurantId, supplierId);

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.supplierLedgerEntry.create({
        data: {
          supplierId,
          type: "PAYMENT",
          amount: dto.amount,
          description: dto.description,
          createdById: currentUserId,
        },
        include: { createdBy: { select: { id: true, name: true, username: true } } },
      });
      await tx.supplier.update({ where: { id: supplierId }, data: { balance: { decrement: dto.amount } } });
      return entry;
    });
  }

  private async requireSupplier(restaurantId: string, id: string): Promise<PrismaSupplier> {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, restaurantId } });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
    return supplier;
  }
}
