import { BaseExtractor, MysqlRow } from './base.extractor';

export interface MysqlInvestmentType extends MysqlRow {
  id: number;
  name: string;
  description?: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class TiposInvestimentoExtractor extends BaseExtractor {
  async extract(): Promise<MysqlInvestmentType[]> {
    return this.extractAll<MysqlInvestmentType>('tipos_investimento', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('tipos_investimento');
  }
}
