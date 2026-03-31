import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';

/**
 * Driver de armazenamento local.
 * Salva arquivos em {UPLOADS_DIR}/{userId}/{fileId}.{ext}.
 */
export const localDriver = {
  /**
   * @param {{ userId: string, fileId: string, ext: string, buffer: Buffer }} params
   * @returns {Promise<{ storagePath: string, url: string }>}
   */
  async upload({ userId, fileId, ext, buffer }) {
    const uploadsDir = config.UPLOADS_DIR || './uploads';
    const userDir = path.join(uploadsDir, userId);
    await mkdir(userDir, { recursive: true });

    const filename = `${fileId}.${ext}`;
    const storagePath = path.join(userDir, filename);
    await writeFile(storagePath, buffer);

    return { storagePath, url: storagePath };
  },

  /**
   * @param {{ storagePath: string }} params
   * @returns {Promise<void>}
   */
  async delete({ storagePath }) {
    try {
      await unlink(storagePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  },

  /**
   * @param {{ storagePath: string }} params
   * @returns {Promise<string>}
   */
  async getDownloadReference({ storagePath }) {
    return storagePath;
  },
};
