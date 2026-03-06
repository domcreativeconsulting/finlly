import { BaseExtractor, MysqlRow } from './base.extractor';

export interface MysqlCoupon extends MysqlRow {
  id: number;
  codigo: string;
  tipo: 'percentual' | 'valor';
  valor: number;
  trial_dias?: number | null;
  somente_plano?: 'mensal' | 'anual' | 'ambos' | null;
  ativo: number;
  max_usos?: number | null;
  usos: number;
  data_expiracao?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class CuponsExtractor extends BaseExtractor {
  async extract(): Promise<MysqlCoupon[]> {
    return this.extractAll<MysqlCoupon>('cupons', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('cupons');
  }
}
