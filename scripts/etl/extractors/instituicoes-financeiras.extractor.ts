import { BaseExtractor, MysqlRow } from './base.extractor';

export interface MysqlBank extends MysqlRow {
  id: number;
  name: string;
  ispb?: string;
  compe?: string;
  logo_url?: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class InstituicoesFinanceirasExtractor extends BaseExtractor {
  async extract(): Promise<MysqlBank[]> {
    return this.extractAll<MysqlBank>('instituicoes_financeiras', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('instituicoes_financeiras');
  }
}
