import { Injectable } from "@nestjs/common";
import type { ArcaClient, ArcaEnvironment, ArcaWsaaSessionKey, ArcaAuthCredentials } from "facturas";
import type { FiscalConfiguration as PrismaFiscalConfiguration } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ArcaClientFactory {
  constructor(private readonly prisma: PrismaService) {}

  async create(fiscalConfig: PrismaFiscalConfiguration): Promise<ArcaClient> {
    const { createArcaClient } = await import("facturas");
    const prisma = this.prisma;
    const configId = fiscalConfig.id;

    return createArcaClient({
      taxId: fiscalConfig.cuit,
      certificatePem: fiscalConfig.certificate,
      privateKeyPem: fiscalConfig.privateKey,
      environment: fiscalConfig.environment === "production" ? "production" : ("test" as ArcaEnvironment),
      wsaaSessionStore: {
        async get(_key: ArcaWsaaSessionKey): Promise<ArcaAuthCredentials | null> {
          const current = await prisma.fiscalConfiguration.findUnique({ where: { id: configId } });
          if (!current?.wsaaToken || !current.wsaaSign || !current.wsaaTokenExpiry) {
            return null;
          }
          return { token: current.wsaaToken, sign: current.wsaaSign, expiresAt: current.wsaaTokenExpiry.toISOString() };
        },
        async set(_key: ArcaWsaaSessionKey, credentials: ArcaAuthCredentials): Promise<void> {
          await prisma.fiscalConfiguration.update({
            where: { id: configId },
            data: {
              wsaaToken: credentials.token,
              wsaaSign: credentials.sign,
              wsaaTokenExpiry: new Date(credentials.expiresAt),
            },
          });
        },
        async withLock<T>(_key: ArcaWsaaSessionKey, fn: () => Promise<T>): Promise<T> {
          return fn();
        },
      },
    });
  }
}
