import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlCategory extends MysqlRow {
  id: number;
  user_id?: number | null;
  name: string;
  type: string;
  icon?: string;
  color?: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class CategoriasExtractor extends BaseExtractor {
  async extract(): Promise<MysqlCategory[]> {
    return this.extractAll<MysqlCategory>('categories', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('categories');
  }
}
