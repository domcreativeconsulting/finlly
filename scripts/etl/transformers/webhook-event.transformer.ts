import { MysqlWebhookLog } from '../extractors/webhook-events.extractor';
import { toTimestamptz, toBoolean, parseJson } from './type-converter';

export interface PostgresWebhookEvent {
  provider: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  processado: boolean;
  processado_em?: Date;
  erro?: string;
  created_at: Date;
}

export function transformWebhookEvent(row: MysqlWebhookLog): PostgresWebhookEvent {
  return {
    provider: String(row.provider ?? ''),
    event_id: String(row.event_id ?? ''),
    event_type: String(row.event_type ?? ''),
    payload: parseJson(row.payload) ?? {},
    processado: toBoolean(row.processed),
    processado_em: toTimestamptz(row.processed_at),
    erro: row.error ? String(row.error) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
  };
}
