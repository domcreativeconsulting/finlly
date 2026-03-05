import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlAccount extends MysqlRow {
  id: number;
  user_id: number;
  name: string;
  type: string;
  bank_id?: number | null;
  color?: string;
  icon?: string;
  include_in_total: number;
  status: string;
  balance: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class ContasExtractor extends BaseExtractor {
  async extract(): Promise<MysqlAccount[]> {
    return this.extractAll<MysqlAccount>('contas', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('contas');
  }
}
