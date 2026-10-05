import { BadRequestException, Injectable } from "@nestjs/common";
import type { FiscalConfiguration as PrismaFiscalConfiguration } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateFiscalConfigDto } from "./dto/update-fiscal-config.dto";

@Injectable()
export class FiscalConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(restaurantId: string) {
    const config = await this.prisma.fiscalConfiguration.findUnique({ where: { restaurantId } });
    return config ? this.toPublicView(config) : null;
  }

  async update(restaurantId: string, dto: UpdateFiscalConfigDto) {
    const existing = await this.prisma.fiscalConfiguration.findUnique({ where: { restaurantId } });

    if (!existing) {
      if (!dto.cuit || !dto.businessName || !dto.certificate || !dto.privateKey || !dto.salesPointNumber) {
        throw new BadRequestException(
          "cuit, businessName, certificate, privateKey and salesPointNumber are required to set up fiscal configuration",
        );
      }
      const created = await this.prisma.fiscalConfiguration.create({
        data: {
          restaurantId,
          cuit: dto.cuit,
          businessName: dto.businessName,
          certificate: dto.certificate,
          privateKey: dto.privateKey,
          salesPointNumber: dto.salesPointNumber,
          issuerCondition: dto.issuerCondition,
          environment: dto.environment,
          autoIssue: dto.autoIssue,
        },
      });
      return this.toPublicView(created);
    }

    const updated = await this.prisma.fiscalConfiguration.update({
      where: { restaurantId },
      data: {
        cuit: dto.cuit,
        businessName: dto.businessName,
        certificate: dto.certificate,
        privateKey: dto.privateKey,
        salesPointNumber: dto.salesPointNumber,
        issuerCondition: dto.issuerCondition,
        environment: dto.environment,
        autoIssue: dto.autoIssue,
      },
    });
    return this.toPublicView(updated);
  }

  async requireForRestaurant(restaurantId: string): Promise<PrismaFiscalConfiguration> {
    const config = await this.prisma.fiscalConfiguration.findUnique({ where: { restaurantId } });
    if (!config) {
      throw new BadRequestException("Fiscal configuration is not set up for this restaurant");
    }
    return config;
  }

  private toPublicView(config: PrismaFiscalConfiguration) {
    const { certificate, privateKey, wsaaToken, wsaaSign, ...rest } = config;
    return { ...rest, hasCertificate: !!certificate, hasPrivateKey: !!privateKey };
  }
}
