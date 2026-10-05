---
name: mangiar-fiscal
description: Facturación electrónica AFIP/ARCA de Mangiar v2. Usar al trabajar en la emisión de facturas, el cliente ARCA, el caché de token WSAA, o cualquier cosa relacionada a CAE/comprobantes fiscales.
---

# Mangiar v2 — Facturación AFIP/ARCA

Emisión manual (nunca automática) de comprobantes electrónicos vía ARCA (ex AFIP). Módulo `Module.FISCAL`. **No probado todavía con un CAE real** — todo lo que sigue fue validado con certificado dummy (falla de parseo esperada) o lógicamente, no contra el ambiente de homologación real de ARCA. Ver `mangiar-architecture`.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/fiscal/`): `fiscal-config.controller.ts`/`fiscal-config.service.ts`, `invoices.controller.ts`/`invoices.service.ts`, `arca-client.factory.ts`, `fiscal.module.ts`, `dto/update-fiscal-config.dto.ts`.
- **Prisma**: `FiscalConfiguration` (una fila por restaurante — `cuit`, `businessName`, `certificate`/`privateKey` como PEM en texto, `salesPointNumber`, `issuerCondition`, `environment`, `wsaaToken`/`wsaaSign`/`wsaaTokenExpiry`, `autoIssue` sin usar todavía), `Invoice`, `Order`.
- **Shared**: `packages/shared/src/schemas/fiscal.schema.ts` (sin enum dedicado — `InvoiceStatus` vive solo en Prisma, no se expuso en la capa Zod).
- **Frontend**: `apps/app/src/routes/_app/invoices/index.tsx`, `apps/app/src/routes/_app/settings/fiscal.tsx`. El botón "Facturar" vive en el detalle de pedido de `mangiar-orders`, no acá.
- **Desktop**: ninguno.

## Decisiones y convenciones

- **Librería: `facturas` (LaPyme), no `afip.ts`**. Se investigó explícitamente: `afip.ts` fue renombrado por su propio mantenedor a `@arcasdk/core` (rama legacy), mientras que `facturas` tiene API de alto nivel (`issue()`, `issueCreditNote()`, `preview()` dry-run), caché de token WSAA ya resuelto, y está más activamente mantenido. **ESM-only, Node ≥22** — se importa con `await import("facturas")` dinámico dentro de `arca-client.factory.ts`, nunca `import` estático (rompería en el build CommonJS de Nest).
- **Multi-tenant real**: `createArcaClient({ taxId, certificatePem, privateKeyPem, environment, wsaaSessionStore })` se instancia *por restaurante* en cada llamada (no hay un cliente global ni env vars compartidas) — cada `FiscalConfiguration` row es independiente.
- **Caché de token WSAA persistido en DB propia**: `wsaaSessionStore` custom en `arca-client.factory.ts` lee/escribe directo `FiscalConfiguration.wsaaToken`/`wsaaSign`/`wsaaTokenExpiry` vía Prisma — así el token sobrevive reinicios del server, no solo el proceso en memoria. El `key` que la librería pasa a `get`/`set` se ignora a propósito (cada instancia de cliente ya está cerrada sobre un único restaurante/CUIT, no hay ambigüedad que resolver desde ahí).
- **`issuerCondition`** (`responsable_inscripto`|`monotributo`|`exento`|`no_alcanzado`) es un campo que **no estaba en el plan original** — se agregó porque `facturas` lo necesita para decidir el tipo de comprobante (A/B/C vía `ARCA_INVOICE_CLASS_BY_ISSUER`), y el schema original (pensado para `afip.ts`, con `invoiceTypeA/B/C` como códigos crudos) no lo tenía. Esos tres campos `invoiceType*` quedaron sin uso tras el cambio de librería — no son dead code a limpiar agresivamente, pero tampoco hay que asumir que están conectados.
- **Monto**: se usa el branch `{ issuer, amounts: VoucherAmounts }` de `IssueInput` (no `items` detallados) porque no hay IVA por producto modelado — si el emisor es `responsable_inscripto`, se asume IVA 21% incluido en el precio y se descompone `net`/`vat` del total; si no, todo es neto sin IVA discriminado. Esto es una simplificación real, no una lectura exacta del padrón del cliente.
- **Nunca automático**: no hay ningún hook que facture sola una orden al completarse — el usuario explícitamente pidió que la facturación sea siempre una decisión manual (`FiscalConfiguration.autoIssue` existe en el schema pero no está conectado a nada).
- Manejo de fallos: cualquier excepción de `arca.issue()` (incluida config/cert inválida) se captura y crea un `Invoice(status: FAILED)` con `arcaResponse` poblado de forma segura (`toArcaSafeErrorMetadata`, nunca expone la clave privada) — nunca debe tirar un 500 sin registrar nada.

## Limitaciones conocidas

- **Sin validar contra ARCA real**: todo lo de arriba está verificado lógicamente y con un certificado dummy (que falla al parsear, como se espera), pero nunca se emitió un CAE real. Antes de dar por "funcionando" este módulo en producción, hace falta un certificado de homologación real y correr el flujo completo una vez.
- `Client.taxId` ausente → siempre se asume `consumidor_final`; no hay consulta al Padrón de ARCA (`facturas` sí expone un módulo `padron` para esto) para resolver la condición de IVA real del cliente — mejora real pendiente, no implementada.
