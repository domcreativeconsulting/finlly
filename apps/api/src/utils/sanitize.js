const SENSITIVE_KEYS = ['authorization', 'cookie', 'password', 'token', 'secret', 'apikey', 'api_key'];
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const MASK = '****';

function maskValue(value) {
  const str = String(value);
  if (str.length <= 4) return MASK;
  return `${MASK}${str.slice(-4)}`;
}

export function sanitize(obj) {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') return obj.replace(CPF_PATTERN, MASK);
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((k) => lowerKey.includes(k))) {
      result[key] = maskValue(typeof value === 'string' ? value : String(value));
    } else {
      result[key] = sanitize(value);
    }
  }
  return result;
}
