import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlCoupon extends MysqlRow {
  id: number;
  code: string;
  discount: number;
  discount_type?: string;
  valid_until?: Date | string | null;
  max_uses?: number | null;
  current_uses: number;
  active: number;
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
