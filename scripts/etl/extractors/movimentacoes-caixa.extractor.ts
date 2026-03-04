import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlTransaction extends MysqlRow {
  id: number;
  user_id: number;
  account_id: number;
  type: string;
  amount: number;
  description: string;
  date: Date | string;
  category_id?: number | null;
  destination_account_id?: number | null;
  bill_id?: number | null;
  receivable_id?: number | null;
  notes?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class MovimentacoesCaixaExtractor extends BaseExtractor {
  async extract(): Promise<MysqlTransaction[]> {
    return this.extractAll<MysqlTransaction>('transactions', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('transactions');
  }
}
