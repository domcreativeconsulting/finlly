import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlInvestmentEvent extends MysqlRow {
  id: number;
  investment_id: number;
  user_id: number;
  type: string;
  amount: number;
  date: Date | string;
  description?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class InvestimentosEventosExtractor extends BaseExtractor {
  async extract(): Promise<MysqlInvestmentEvent[]> {
    return this.extractAll<MysqlInvestmentEvent>('investimentos_eventos', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('investimentos_eventos');
  }
}
