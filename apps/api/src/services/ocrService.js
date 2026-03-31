import logger from '../logger.js';
import { config } from '../config/env.js';

/**
 * Mock OCR provider — returns simulated data with low confidence.
 * @param {{ filePath: string, mimeType: string }} params
 * @returns {Promise<OcrResult>}
 */
async function processarMock({ filePath, mimeType }) {
  logger.warn({ filePath, mimeType }, 'OCR usando provider mock — dados simulados.');
  return {
    extractedAmount: null,
    extractedDate: null,
    extractedDescription: 'Documento processado (mock)',
    extractedType: null,
    confidenceScore: 0.1,
    rawText: '[mock] Texto extraído simulado.',
  };
}

/**
 * Google Vision provider stub — not yet implemented.
 * @param {{ filePath: string, mimeType: string }} params
 */
async function processarGoogleVision({ filePath, mimeType }) {
  void filePath;
  void mimeType;
  throw new Error('Provider não configurado');
}

/**
 * AWS Textract provider stub — not yet implemented.
 * @param {{ filePath: string, mimeType: string }} params
 */
async function processarAwsTextract({ filePath, mimeType }) {
  void filePath;
  void mimeType;
  throw new Error('Provider não configurado');
}

/**
 * @typedef {Object} OcrResult
 * @property {number|null} extractedAmount
 * @property {Date|string|null} extractedDate
 * @property {string|null} extractedDescription
 * @property {string|null} extractedType
 * @property {number|null} confidenceScore
 * @property {string|null} rawText
 */

/**
 * Processa um documento via OCR/IA.
 * O provider é configurado via env OCR_PROVIDER (mock | google_vision | aws_textract).
 *
 * @param {{ anexoId: string, filePath: string, mimeType: string }} params
 * @returns {Promise<OcrResult>}
 */
export async function processarDocumento({ anexoId, filePath, mimeType }) {
  const provider = config.OCR_PROVIDER;

  logger.info({ anexoId, provider }, 'Iniciando processamento OCR.');

  switch (provider) {
    case 'google_vision':
      return processarGoogleVision({ filePath, mimeType });
    case 'aws_textract':
      return processarAwsTextract({ filePath, mimeType });
    case 'mock':
    default:
      return processarMock({ filePath, mimeType });
  }
}
