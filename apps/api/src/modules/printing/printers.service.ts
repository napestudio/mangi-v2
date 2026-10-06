import { Injectable, NotFoundException } from "@nestjs/common";
import type { Printer as PrismaPrinter } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatePrinterDto } from "./dto/create-printer.dto";
import type { UpdatePrinterDto } from "./dto/update-printer.dto";

@Injectable()
export class PrintersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<PrismaPrinter[]> {
    return this.prisma.printer.findMany({ where: { restaurantId }, orderBy: { createdAt: "asc" } });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaPrinter> {
    const printer = await this.prisma.printer.findFirst({ where: { id, restaurantId } });
    if (!printer) {
      throw new NotFoundException("Printer not found");
    }
    return printer;
  }

  create(restaurantId: string, dto: CreatePrinterDto): Promise<PrismaPrinter> {
    return this.prisma.printer.create({
      data: {
        restaurantId,
        name: dto.name,
        connectionType: dto.connectionType,
        ipAddress: dto.ipAddress,
        port: dto.port,
        usbPath: dto.usbPath,
        paperWidth: dto.paperWidth,
        printMode: dto.printMode,
        headerText: dto.headerText,
        footerText: dto.footerText,
        copies: dto.copies,
        stationId: dto.stationId,
      },
    });
  }

  async update(restaurantId: string, id: string, dto: UpdatePrinterDto): Promise<PrismaPrinter> {
    await this.findOne(restaurantId, id);
    return this.prisma.printer.update({
      where: { id },
      data: {
        name: dto.name,
        connectionType: dto.connectionType,
        ipAddress: dto.ipAddress,
        port: dto.port,
        usbPath: dto.usbPath,
        paperWidth: dto.paperWidth,
        printMode: dto.printMode,
        headerText: dto.headerText,
        footerText: dto.footerText,
        copies: dto.copies,
        stationId: dto.stationId,
        isActive: dto.isActive,
      },
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.printer.delete({ where: { id } });
  }

  async updateHeartbeat(
    restaurantId: string,
    id: string,
    status: "ONLINE" | "OFFLINE" | "ERROR",
  ): Promise<PrismaPrinter> {
    await this.findOne(restaurantId, id);
    return this.prisma.printer.update({ where: { id }, data: { status } });
  }
}
