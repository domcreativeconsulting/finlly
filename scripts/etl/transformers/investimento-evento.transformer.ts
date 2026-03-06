import { MysqlInvestmentEvent } from '../extractors/investimentos-eventos.extractor';
import { mapId } from './id-mapper';
import { toTimestamptz, toDateOnly, toTipoEventoInvestimento } from './type-converter';

export interface PostgresInvestimentoEvento {
  id: string;
  investimento_id: string;
  usuario_id: string;
  tipo: 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'dividendo';
  valor: number;
  data: Date;
  descricao?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformInvestimentoEvento(
  row: MysqlInvestmentEvent,
  validInvestimentoIds: Set<string>,
): PostgresInvestimentoEvento | null {
  const investimentoId = mapId(row.investment_id, 'investments');
  if (!validInvestimentoIds.has(investimentoId)) {
    console.warn(
      `   ⚠️  InvestimentoEvento id=${row.id} investimento_id=${row.investment_id} não existe — registro será ignorado`,
    );
    return null;
  }
  return {
    id: mapId(row.id, 'investment_events'),
    investimento_id: investimentoId,
    usuario_id: mapId(row.user_id, 'users'),
    tipo: toTipoEventoInvestimento(row.type),
    // valor CHECK: > 0
    valor: Math.max(0.01, Math.abs(Number(row.amount ?? 0.01))),
    data: toDateOnly(row.date) ?? new Date(),
    descricao: row.description ? String(row.description) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
