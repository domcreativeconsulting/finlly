import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlReceivable extends MysqlRow {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  due_date: Date | string;
  received_date?: Date | string | null;
  status: string;
  category_id?: number | null;
  account_id?: number | null;
  recurring: number;
  recurrence?: string | null;
  notes?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class ContasReceberExtractor extends BaseExtractor {
  async extract(): Promise<MysqlReceivable[]> {
    return this.extractAll<MysqlReceivable>('receivables', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('receivables');
  }
}
