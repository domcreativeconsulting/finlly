import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';

function createS3Client() {
  return new S3Client({
    region: config.S3_REGION || 'us-east-1',
    credentials:
      config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: config.S3_ACCESS_KEY_ID,
            secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
  });
}

/**
 * Driver de armazenamento S3.
 * Envia arquivos para bucket configurado com key uploads/{userId}/{fileId}.{ext}.
 */
export const s3Driver = {
  /**
   * @param {{ userId: string, fileId: string, ext: string, buffer: Buffer, mimetype: string }} params
   * @returns {Promise<{ storagePath: string, url: string }>}
   */
  async upload({ userId, fileId, ext, buffer, mimetype }) {
    const client = createS3Client();
    const key = `uploads/${userId}/${fileId}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    const url = config.S3_PUBLIC_BASE_URL ? `${config.S3_PUBLIC_BASE_URL}/${key}` : key;

    return { storagePath: key, url };
  },

  /**
   * @param {{ storagePath: string }} params
   * @returns {Promise<void>}
   */
  async delete({ storagePath }) {
    const client = createS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: storagePath,
      }),
    );
  },

  /**
   * Retorna URL pública se S3_PUBLIC_BASE_URL configurado, senão gera pre-signed URL (1h).
   * @param {{ storagePath: string }} params
   * @returns {Promise<string>}
   */
  async getDownloadReference({ storagePath }) {
    if (config.S3_PUBLIC_BASE_URL) {
      return `${config.S3_PUBLIC_BASE_URL}/${storagePath}`;
    }

    const client = createS3Client();
    const command = new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: storagePath,
    });

    return getSignedUrl(client, command, { expiresIn: 3600 });
  },
};
