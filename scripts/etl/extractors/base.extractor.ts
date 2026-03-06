import mysql from 'mysql2/promise';
import { config } from '../config';

export interface MysqlRow {
  [key: string]: unknown;
}

export class BaseExtractor {
  protected connection: mysql.Connection | null = null;

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection(config.mysql);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  protected async query<T extends MysqlRow = MysqlRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    if (!this.connection) {
      throw new Error('Extractor not connected. Call connect() first.');
    }
    const [rows] = await this.connection.query<mysql.RowDataPacket[]>(sql, params);
    return rows as T[];
  }

  async count(table: string, where?: string): Promise<number> {
    const sql = where ? `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}` : `SELECT COUNT(*) AS n FROM ${table}`;
    const rows = await this.query<{ n: number }>(sql);
    return Number(rows[0]?.n ?? 0);
  }

  async extractAll<T extends MysqlRow = MysqlRow>(
    table: string,
    columns = '*',
    orderBy?: string,
  ): Promise<T[]> {
    const order = orderBy ? ` ORDER BY ${orderBy}` : '';
    return this.query<T>(`SELECT ${columns} FROM ${table}${order}`);
  }

  async extractBatch<T extends MysqlRow = MysqlRow>(
    table: string,
    offset: number,
    batchSize: number,
    columns = '*',
    orderBy = 'id',
  ): Promise<T[]> {
    return this.query<T>(
      `SELECT ${columns} FROM ${table} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [batchSize, offset],
    );
  }
}
