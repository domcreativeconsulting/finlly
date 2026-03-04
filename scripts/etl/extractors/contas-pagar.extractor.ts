import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlBill extends MysqlRow {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  due_date: Date | string;
  payment_date?: Date | string | null;
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

export class ContasPagarExtractor extends BaseExtractor {
  async extract(): Promise<MysqlBill[]> {
    return this.extractAll<MysqlBill>('bills', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('bills');
  }
}
