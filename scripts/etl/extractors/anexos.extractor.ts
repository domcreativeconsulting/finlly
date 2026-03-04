import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlAttachment extends MysqlRow {
  id: number;
  user_id: number;
  original_name: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class AnexosExtractor extends BaseExtractor {
  async extract(): Promise<MysqlAttachment[]> {
    return this.extractAll<MysqlAttachment>('attachments', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('attachments');
  }
}
