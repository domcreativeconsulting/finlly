import { BaseExtractor, MysqlRow } from './base.extractor';

export interface MysqlUsuario extends MysqlRow {
  id: number;
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar_url?: string;
  email_verified: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class UsuariosExtractor extends BaseExtractor {
  async extract(): Promise<MysqlUsuario[]> {
    return this.extractAll<MysqlUsuario>('usuarios', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('usuarios');
  }
}
