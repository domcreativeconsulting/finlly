const GENERIC_MESSAGES = [
  'an unexpected error occurred',
  'internal server error',
  'something went wrong',
];

/**
 * Extrai a mensagem de erro legível de um erro de API axios.
 * Evita repassar mensagens genéricas de servidor para o usuário.
 *
 * @param {unknown} err - O erro capturado no catch
 * @param {string} fallback - Mensagem amigável padrão caso a API não retorne nada útil
 * @returns {string}
 */
export function getApiError(err, fallback = 'Ocorreu um erro inesperado. Tente novamente.') {
  const msg =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    '';

  if (!msg || GENERIC_MESSAGES.includes(msg.toLowerCase())) {
    return fallback;
  }

  return msg;
}
