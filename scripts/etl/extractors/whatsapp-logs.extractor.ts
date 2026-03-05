import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlWhatsappMessage extends MysqlRow {
  id: number;
  user_id?: number | null;
  provider: string;
  phone: string;
  direction: string;
  message_type: string;
  content?: string | null;
  status?: string | null;
  provider_message_id?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class WhatsappLogsExtractor extends BaseExtractor {
  async extract(): Promise<MysqlWhatsappMessage[]> {
    return this.extractAll<MysqlWhatsappMessage>('whatsapp_logs', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('whatsapp_logs');
  }
}
