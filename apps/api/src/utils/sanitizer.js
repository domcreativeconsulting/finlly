const MASK_PREFIX = '****...';

function maskEnd(value) {
  if (typeof value !== 'string' || value.length <= 4) return MASK_PREFIX;
  return MASK_PREFIX + value.slice(-4);
}

function maskCpf(value) {
  if (typeof value !== 'string') return MASK_PREFIX;
  const digits = value.replace(/\D/g, '');
  return MASK_PREFIX + digits.slice(-4);
}

function maskUrl(value) {
  if (typeof value !== 'string') return MASK_PREFIX;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return MASK_PREFIX;
  }
}

const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

export function sanitizeLogs(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data
      .replace(JWT_PATTERN, (match) => maskEnd(match))
      .replace(CPF_PATTERN, (match) => maskCpf(match));
  }

  if (typeof data !== 'object') return data;

  const result = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === 'authorization' || lowerKey === 'cookie') {
      result[key] = MASK_PREFIX;
    } else if (
      lowerKey.includes('token') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password')
    ) {
      result[key] = typeof value === 'string' ? maskEnd(value) : MASK_PREFIX;
    } else if (lowerKey === 'database_url' || lowerKey === 'redis_url') {
      result[key] = maskUrl(value);
    } else if (lowerKey === 'cpf') {
      result[key] = maskCpf(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeLogs(value);
    } else if (typeof value === 'string') {
      result[key] = value
        .replace(JWT_PATTERN, (match) => maskEnd(match))
        .replace(CPF_PATTERN, (match) => maskCpf(match));
    } else {
      result[key] = value;
    }
  }
  return result;
}
