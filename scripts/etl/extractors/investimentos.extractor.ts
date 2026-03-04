import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlInvestment extends MysqlRow {
  id: number;
  user_id: number;
  name: string;
  type_id: number;
  bank_id?: number | null;
  initial_value: number;
  current_value: number;
  start_date: Date | string;
  maturity_date?: Date | string | null;
  status: string;
  notes?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class InvestimentosExtractor extends BaseExtractor {
  async extract(): Promise<MysqlInvestment[]> {
    return this.extractAll<MysqlInvestment>('investments', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('investments');
  }
}
