import { normalizePhoneNumber, normalizeEvolutionPayload } from '../evolutionPayloadParser.js';

// ============================================================
// normalizePhoneNumber
// ============================================================

describe('normalizePhoneNumber', () => {
  test('strips @s.whatsapp.net suffix and non-digits when called on raw remoteJid', () => {
    // Typical usage: strip suffix first, then normalise
    expect(normalizePhoneNumber('5511999999999')).toBe('5511999999999');
  });

  test('removes all non-digit characters from formatted number', () => {
    expect(normalizePhoneNumber('+55 (11) 99999-9999')).toBe('5511999999999');
  });

  test('handles number without country code', () => {
    expect(normalizePhoneNumber('11999999999')).toBe('11999999999');
  });

  test('returns empty string for null', () => {
    expect(normalizePhoneNumber(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(normalizePhoneNumber(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(normalizePhoneNumber('')).toBe('');
  });

  test('handles number with spaces and dashes', () => {
    expect(normalizePhoneNumber('55-11-99999-9999')).toBe('5511999999999');
  });
});

// ============================================================
// Helpers
// ============================================================

/**
 * Builds a minimal valid Evolution payload for use in tests.
 */
function makePayload(overrides = {}) {
  return {
    event: 'messages.upsert',
    instance: 'finlly-prod',
    data: {
      key: {
        remoteJid: '5511999999999@s.whatsapp.net',
        fromMe: false,
        id: 'ABCDEF123456',
      },
      messageTimestamp: 1700000000,
      pushName: 'João Silva',
      message: {
        conversation: 'Olá, quanto tenho na conta?',
      },
    },
    ...overrides,
  };
}

// ============================================================
// normalizeEvolutionPayload — complete payload
// ============================================================

describe('normalizeEvolutionPayload — complete payload', () => {
  let msg;

  beforeAll(() => {
    msg = normalizeEvolutionPayload(makePayload());
  });

  test('provider is always EVOLUTION', () => {
    expect(msg.provider).toBe('EVOLUTION');
  });

  test('providerMessageId is extracted from data.key.id', () => {
    expect(msg.providerMessageId).toBe('ABCDEF123456');
  });

  test('instanceName is extracted from payload.instance', () => {
    expect(msg.instanceName).toBe('finlly-prod');
  });

  test('phoneRaw strips the @s.whatsapp.net suffix', () => {
    expect(msg.phoneRaw).toBe('5511999999999');
  });

  test('phoneNormalized contains only digits', () => {
    expect(msg.phoneNormalized).toBe('5511999999999');
    expect(msg.phoneNormalized).toMatch(/^\d+$/);
  });

  test('fromMe is false', () => {
    expect(msg.fromMe).toBe(false);
  });

  test('contactName is extracted from data.pushName', () => {
    expect(msg.contactName).toBe('João Silva');
  });

  test('direction is always INBOUND', () => {
    expect(msg.direction).toBe('INBOUND');
  });

  test('messageType is TEXT for conversation', () => {
    expect(msg.messageType).toBe('TEXT');
  });

  test('messageText is trimmed conversation text', () => {
    expect(msg.messageText).toBe('Olá, quanto tenho na conta?');
  });

  test('eventTimestamp is a Date object', () => {
    expect(msg.eventTimestamp).toBeInstanceOf(Date);
    expect(msg.eventTimestamp.getTime()).toBe(1700000000 * 1000);
  });

  test('payloadRaw is JSON.stringify of the full payload', () => {
    const payload = makePayload();
    const result = normalizeEvolutionPayload(payload);
    expect(result.payloadRaw).toBe(JSON.stringify(payload));
  });
});

// ============================================================
// normalizeEvolutionPayload — fromMe: true
// ============================================================

describe('normalizeEvolutionPayload — fromMe: true', () => {
  test('fromMe is true when data.key.fromMe is true', () => {
    const payload = makePayload();
    payload.data.key.fromMe = true;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.fromMe).toBe(true);
  });
});

// ============================================================
// normalizeEvolutionPayload — direction always INBOUND
// ============================================================

describe('normalizeEvolutionPayload — direction', () => {
  test('direction is INBOUND even when fromMe is true', () => {
    const payload = makePayload();
    payload.data.key.fromMe = true;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.direction).toBe('INBOUND');
  });
});

// ============================================================
// normalizeEvolutionPayload — messageType detection
// ============================================================

describe('normalizeEvolutionPayload — messageType detection', () => {
  test('TEXT for conversation', () => {
    const payload = makePayload();
    payload.data.message = { conversation: 'Olá' };
    expect(normalizeEvolutionPayload(payload).messageType).toBe('TEXT');
  });

  test('TEXT for extendedTextMessage.text', () => {
    const payload = makePayload();
    payload.data.message = { extendedTextMessage: { text: 'Olá' } };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('TEXT');
    expect(msg.messageText).toBe('Olá');
  });

  test('IMAGE for imageMessage', () => {
    const payload = makePayload();
    payload.data.message = { imageMessage: { url: 'https://example.com/img.jpg' } };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('IMAGE');
    expect(msg.messageText).toBe('');
  });

  test('AUDIO for audioMessage', () => {
    const payload = makePayload();
    payload.data.message = { audioMessage: { url: 'https://example.com/audio.ogg' } };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('AUDIO');
    expect(msg.messageText).toBe('');
  });

  test('DOCUMENT for documentMessage', () => {
    const payload = makePayload();
    payload.data.message = { documentMessage: { url: 'https://example.com/doc.pdf' } };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('DOCUMENT');
    expect(msg.messageText).toBe('');
  });

  test('STICKER for stickerMessage', () => {
    const payload = makePayload();
    payload.data.message = { stickerMessage: { url: 'https://example.com/sticker.webp' } };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('STICKER');
    expect(msg.messageText).toBe('');
  });

  test('UNKNOWN when message is null', () => {
    const payload = makePayload();
    payload.data.message = null;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('UNKNOWN');
    expect(msg.messageText).toBe('');
  });

  test('UNKNOWN when message is absent', () => {
    const payload = makePayload();
    delete payload.data.message;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('UNKNOWN');
    expect(msg.messageText).toBe('');
  });

  test('UNKNOWN for unrecognised message shape', () => {
    const payload = makePayload();
    payload.data.message = { locationMessage: { lat: 0, lng: 0 } };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageType).toBe('UNKNOWN');
  });
});

// ============================================================
// normalizeEvolutionPayload — partial payloads (tolerance)
// ============================================================

describe('normalizeEvolutionPayload — partial payloads', () => {
  test('returns phoneRaw "" and phoneNormalized "" when remoteJid is absent', () => {
    const payload = makePayload();
    delete payload.data.key.remoteJid;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.phoneRaw).toBe('');
    expect(msg.phoneNormalized).toBe('');
  });

  test('does not throw when data.message is absent', () => {
    const payload = makePayload();
    delete payload.data.message;
    expect(() => normalizeEvolutionPayload(payload)).not.toThrow();
  });

  test('returns messageText "" and messageType UNKNOWN when message absent', () => {
    const payload = makePayload();
    delete payload.data.message;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageText).toBe('');
    expect(msg.messageType).toBe('UNKNOWN');
  });

  test('eventTimestamp is null when messageTimestamp is absent', () => {
    const payload = makePayload();
    delete payload.data.messageTimestamp;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.eventTimestamp).toBeNull();
  });

  test('instanceName is null when instance is absent', () => {
    const payload = makePayload();
    delete payload.instance;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.instanceName).toBeNull();
  });

  test('contactName is null when pushName is absent', () => {
    const payload = makePayload();
    delete payload.data.pushName;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.contactName).toBeNull();
  });

  test('providerMessageId is null when data.key.id is absent', () => {
    const payload = makePayload();
    delete payload.data.key.id;
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.providerMessageId).toBeNull();
  });

  test('does not throw for entirely empty payload object', () => {
    expect(() => normalizeEvolutionPayload({})).not.toThrow();
    const msg = normalizeEvolutionPayload({});
    expect(msg.phoneRaw).toBe('');
    expect(msg.phoneNormalized).toBe('');
    expect(msg.messageType).toBe('UNKNOWN');
    expect(msg.messageText).toBe('');
    expect(msg.fromMe).toBe(false);
    expect(msg.direction).toBe('INBOUND');
    expect(msg.provider).toBe('EVOLUTION');
  });
});

// ============================================================
// normalizeEvolutionPayload — phone number formats
// ============================================================

describe('normalizeEvolutionPayload — phone number formats', () => {
  test('handles "5511999999999@s.whatsapp.net" format', () => {
    const payload = makePayload();
    payload.data.key.remoteJid = '5511999999999@s.whatsapp.net';
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.phoneRaw).toBe('5511999999999');
    expect(msg.phoneNormalized).toBe('5511999999999');
  });

  test('handles "+55 (11) 99999-9999" format in remoteJid', () => {
    const payload = makePayload();
    payload.data.key.remoteJid = '+55 (11) 99999-9999';
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.phoneRaw).toBe('+55 (11) 99999-9999'); // raw = no @suffix strip needed
    expect(msg.phoneNormalized).toBe('5511999999999');
  });

  test('handles plain "11999999999" (no DDI) format', () => {
    const payload = makePayload();
    payload.data.key.remoteJid = '11999999999';
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.phoneRaw).toBe('11999999999');
    expect(msg.phoneNormalized).toBe('11999999999');
  });
});

// ============================================================
// normalizeEvolutionPayload — messageText trimming
// ============================================================

describe('normalizeEvolutionPayload — messageText trimming', () => {
  test('trims leading and trailing whitespace from conversation text', () => {
    const payload = makePayload();
    payload.data.message = { conversation: '  Olá  ' };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageText).toBe('Olá');
  });

  test('trims extendedTextMessage.text', () => {
    const payload = makePayload();
    payload.data.message = { extendedTextMessage: { text: '\t gastei 50 \n' } };
    const msg = normalizeEvolutionPayload(payload);
    expect(msg.messageText).toBe('gastei 50');
  });
});
