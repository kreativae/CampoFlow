import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Commodity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const REDACAO_AGRO_URL = 'https://www.redacaoagro.com.br/api/cotacoes.php';
const SOURCE_LABEL = 'Redação Agro (ref. CEPEA/ESALQ)';

// Only commodities Redação Agro's free endpoint covers that also exist in our
// Commodity enum get auto-updated; everything else (vaca gorda, novilha, couro,
// sebo, leite, sorgo, farelo de soja) has no free real-time source found and stays
// manual-only (CreateQuotationDto / QuotationsController.create).
const COMMODITY_KEY_MAP: Record<string, Commodity> = {
  soja: Commodity.SOJA,
  milho: Commodity.MILHO,
  boi_gordo: Commodity.BOI_GORDO,
};

interface RedacaoAgroCommodityEntry {
  unidade: string;
  valor: number;
  timestamp: string;
}

interface RedacaoAgroResponse {
  status: string;
  commodities: Record<string, RedacaoAgroCommodityEntry>;
}

// Redação Agro's endpoint is a free, undocumented, unofficial aggregator (it
// references CEPEA/ESALQ as its own upstream reference). There's no SLA, no rate
// limit documented, and no guarantee it stays online — the official CEPEA/ESALQ API
// costs R$10.500 and was judged out of budget for this project. This service is
// built so swapping to a paid/official source later only means rewriting fetchLatest()
// and COMMODITY_KEY_MAP, not anything that depends on QuotationsService.
@Injectable()
export class ExternalQuotationsService implements OnModuleInit {
  private readonly logger = new Logger(ExternalQuotationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // The @Cron below only fires at fixed 3h marks, so on a fresh deploy (empty DB) the
  // quotation-dependent screens — e.g. the "valor estimado do rebanho" in BI — would show
  // a dash until the first tick. Fetch once on boot to close that gap. Skipped under test
  // to keep e2e from hitting the real endpoint before each suite mocks fetch.
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.refresh();
    } catch (err) {
      this.logger.warn(
        `Falha ao buscar cotações no start: ${(err as Error).message}`,
      );
    }
  }

  // Runs every 3 hours — frequent enough to track intraday moves without hammering a
  // free, unofficial endpoint that has no published rate limit.
  @Cron('0 */3 * * *')
  async scheduledRefresh() {
    try {
      const result = await this.refresh();
      if (result.created > 0) {
        this.logger.log(
          `Cotações automáticas atualizadas: ${result.created} novo(s) registro(s)`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao atualizar cotações automáticas: ${(err as Error).message}`,
      );
    }
  }

  async refresh(): Promise<{ created: number; skipped: number }> {
    const data = await this.fetchLatest();
    let created = 0;
    let skipped = 0;

    for (const [key, commodity] of Object.entries(COMMODITY_KEY_MAP)) {
      const entry = data.commodities[key];
      if (!entry) continue;

      const lastAuto = await this.prisma.quotation.findFirst({
        where: { commodity, source: SOURCE_LABEL },
        orderBy: { recordedAt: 'desc' },
      });

      // Skip if the price hasn't moved since the last auto-fetched record, to avoid
      // filling the history with identical duplicates between cron ticks.
      if (lastAuto && lastAuto.price === entry.valor) {
        skipped += 1;
        continue;
      }

      await this.prisma.quotation.create({
        data: {
          commodity,
          price: entry.valor,
          unit: entry.unidade,
          source: SOURCE_LABEL,
          recordedAt: new Date(entry.timestamp.replace(' ', 'T')),
        },
      });
      created += 1;
    }

    return { created, skipped };
  }

  private async fetchLatest(): Promise<RedacaoAgroResponse> {
    const response = await fetch(REDACAO_AGRO_URL);
    if (!response.ok) {
      throw new Error(`Redação Agro respondeu ${response.status}`);
    }
    return (await response.json()) as RedacaoAgroResponse;
  }
}
