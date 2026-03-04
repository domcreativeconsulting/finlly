import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlWebhookLog extends MysqlRow {
  id: number;
  provider: string;
  event_id: string;
  event_type: string;
  payload: string | object;
  processed: number;
  processed_at?: Date | string | null;
  error?: string | null;
  created_at: Date | string;
}

export class WebhookEventsExtractor extends BaseExtractor {
  async extract(): Promise<MysqlWebhookLog[]> {
    return this.extractAll<MysqlWebhookLog>('webhook_logs', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('webhook_logs');
  }
}
