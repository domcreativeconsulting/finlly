import crypto from 'crypto';

/**
 * Converts a MySQL DATETIME / Date object to an ISO 8601 string with UTC timezone (+00:00).
 * MySQL DATETIME has no timezone info; we assume all legacy data is stored in UTC.
 */
export function toTimestamptz(value: Date | string | null | undefined): Date | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d;
}

/**
 * Converts a MySQL DATETIME to a Postgres Date-only value (YYYY-MM-DD).
 */
export function toDateOnly(value: Date | string | null | undefined): Date | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return undefined;
  // Strip time component — keep date in UTC
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Maps legacy MySQL status strings to Postgres ENUM values for `status_assinante`.
 */
export function toStatusAssinante(
  value: string | null | undefined,
): 'trial' | 'ativo' | 'inativo' | 'cancelado' | 'inadimplente' {
  const map: Record<string, 'trial' | 'ativo' | 'inativo' | 'cancelado' | 'inadimplente'> = {
    trial: 'trial',
    active: 'ativo',
    ativo: 'ativo',
    inactive: 'inativo',
    inativo: 'inativo',
    canceled: 'cancelado',
    cancelled: 'cancelado',
    cancelado: 'cancelado',
    defaulting: 'inadimplente',
    inadimplente: 'inadimplente',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'inativo';
}

/**
 * Maps legacy MySQL payment status strings to Postgres ENUM `status_pagamento`.
 */
export function toStatusPagamento(
  value: string | null | undefined,
): 'pendente' | 'pago' | 'cancelado' | 'estornado' | 'falhou' {
  const map: Record<string, 'pendente' | 'pago' | 'cancelado' | 'estornado' | 'falhou'> = {
    pending: 'pendente',
    pendente: 'pendente',
    paid: 'pago',
    pago: 'pago',
    canceled: 'cancelado',
    cancelled: 'cancelado',
    cancelado: 'cancelado',
    refunded: 'estornado',
    estornado: 'estornado',
    failed: 'falhou',
    falhou: 'falhou',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'pendente';
}

/**
 * Maps legacy MySQL account status strings to Postgres ENUM `status_conta`.
 */
export function toStatusConta(
  value: string | null | undefined,
): 'ativa' | 'inativa' | 'arquivada' {
  const map: Record<string, 'ativa' | 'inativa' | 'arquivada'> = {
    active: 'ativa',
    ativa: 'ativa',
    inactive: 'inativa',
    inativo: 'inativa',
    inativa: 'inativa',
    archived: 'arquivada',
    arquivada: 'arquivada',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'ativa';
}

/**
 * Maps legacy MySQL goal status strings to Postgres ENUM `status_meta`.
 */
export function toStatusMeta(
  value: string | null | undefined,
): 'ativa' | 'concluida' | 'cancelada' {
  const map: Record<string, 'ativa' | 'concluida' | 'cancelada'> = {
    active: 'ativa',
    ativa: 'ativa',
    completed: 'concluida',
    concluida: 'concluida',
    canceled: 'cancelada',
    cancelled: 'cancelada',
    cancelada: 'cancelada',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'ativa';
}

/**
 * Maps legacy MySQL account type strings to Postgres ENUM `tipo_conta`.
 */
export function toTipoConta(
  value: string | null | undefined,
): 'corrente' | 'poupanca' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'investimento' | 'outro' {
  const map: Record<
    string,
    'corrente' | 'poupanca' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'investimento' | 'outro'
  > = {
    checking: 'corrente',
    corrente: 'corrente',
    savings: 'poupanca',
    poupanca: 'poupanca',
    credit_card: 'cartao_credito',
    cartao_credito: 'cartao_credito',
    debit_card: 'cartao_debito',
    cartao_debito: 'cartao_debito',
    cash: 'dinheiro',
    dinheiro: 'dinheiro',
    investment: 'investimento',
    investimento: 'investimento',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'outro';
}

/**
 * Maps legacy MySQL transaction type strings to Postgres ENUM `tipo_movimentacao`.
 */
export function toTipoMovimentacao(
  value: string | null | undefined,
): 'entrada' | 'saida' | 'transferencia' {
  const map: Record<string, 'entrada' | 'saida' | 'transferencia'> = {
    income: 'entrada',
    entrada: 'entrada',
    expense: 'saida',
    saida: 'saida',
    transfer: 'transferencia',
    transferencia: 'transferencia',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'saida';
}

/**
 * Maps legacy MySQL investment event type strings to Postgres ENUM `tipo_evento_investimento`.
 */
export function toTipoEventoInvestimento(
  value: string | null | undefined,
): 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'dividendo' {
  const map: Record<string, 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'dividendo'> = {
    deposit: 'aporte',
    aporte: 'aporte',
    withdrawal: 'resgate',
    resgate: 'resgate',
    yield: 'rendimento',
    rendimento: 'rendimento',
    fee: 'taxa',
    taxa: 'taxa',
    dividend: 'dividendo',
    dividendo: 'dividendo',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'rendimento';
}

/**
 * Maps legacy MySQL recurrence type strings to Postgres ENUM `tipo_recorrencia`.
 */
export function toTipoRecorrencia(
  value: string | null | undefined,
):
  | 'diario'
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'
  | undefined {
  if (value == null) return undefined;
  const map: Record<
    string,
    'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  > = {
    daily: 'diario',
    diario: 'diario',
    weekly: 'semanal',
    semanal: 'semanal',
    biweekly: 'quinzenal',
    quinzenal: 'quinzenal',
    monthly: 'mensal',
    mensal: 'mensal',
    bimonthly: 'bimestral',
    bimestral: 'bimestral',
    quarterly: 'trimestral',
    trimestral: 'trimestral',
    semiannual: 'semestral',
    semestral: 'semestral',
    annual: 'anual',
    yearly: 'anual',
    anual: 'anual',
  };
  return map[String(value).toLowerCase()];
}

/**
 * Maps legacy MySQL goal type strings to Postgres ENUM `tipo_meta`.
 */
export function toTipoMeta(
  value: string | null | undefined,
): 'economia' | 'despesa' | 'investimento' {
  const map: Record<string, 'economia' | 'despesa' | 'investimento'> = {
    savings: 'economia',
    economia: 'economia',
    expense: 'despesa',
    despesa: 'despesa',
    investment: 'investimento',
    investimento: 'investimento',
  };
  return map[String(value ?? '').toLowerCase()] ?? 'economia';
}

/**
 * Converts a MySQL tinyint(1) / boolean-like value to a JS boolean.
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return false;
}

/**
 * Generates a SHA-256 hash of the given string value (used for file deduplication).
 * Returns a hex string of 64 characters.
 */
export function generateHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Normalises a hex colour string. Returns undefined if the value is falsy.
 */
export function toHexColor(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const hex = value.startsWith('#') ? value : `#${value}`;
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : undefined;
}

/**
 * Safely parses a JSON string; returns the original value if it's already an object.
 */
export function parseJson(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return String(value);
  }
}
