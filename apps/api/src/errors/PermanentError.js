/**
 * Erro permanente — não deve ser retentado pelo pipeline de retry.
 * Quando lançado, o job vai direto para DLQ sem aguardar tentativas restantes.
 */
export class PermanentError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'PermanentError';
    this.permanent = true;
    if (cause) this.cause = cause;
  }
}
