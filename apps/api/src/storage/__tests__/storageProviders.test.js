import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock: node:fs/promises
// ---------------------------------------------------------------------------
const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('node:fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  unlink: mockUnlink,
}));

// ---------------------------------------------------------------------------
// Mock: config
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    UPLOADS_DIR: '/tmp/test-uploads',
    STORAGE_DRIVER: 'local',
    S3_BUCKET: 'test-bucket',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'test-key',
    S3_SECRET_ACCESS_KEY: 'test-secret',
    S3_ENDPOINT: undefined,
    S3_PUBLIC_BASE_URL: 'https://test-bucket.s3.amazonaws.com',
  },
}));

// ---------------------------------------------------------------------------
// Mock: @aws-sdk/client-s3
// ---------------------------------------------------------------------------
const mockS3Send = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((params) => ({ __type: 'PutObjectCommand', ...params })),
  DeleteObjectCommand: jest.fn((params) => ({ __type: 'DeleteObjectCommand', ...params })),
  GetObjectCommand: jest.fn((params) => ({ __type: 'GetObjectCommand', ...params })),
}));

// ---------------------------------------------------------------------------
// Mock: @aws-sdk/s3-request-presigner
// ---------------------------------------------------------------------------
const mockGetSignedUrl = jest.fn().mockResolvedValue('https://presigned.url/object');

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// ---------------------------------------------------------------------------
// Modules under test
// ---------------------------------------------------------------------------
let localDriver;
let s3Driver;
let getStorageProvider;

beforeAll(async () => {
  const localMod = await import('../localDriver.js');
  localDriver = localMod.localDriver;

  const s3Mod = await import('../s3Driver.js');
  s3Driver = s3Mod.s3Driver;

  const indexMod = await import('../index.js');
  getStorageProvider = indexMod.getStorageProvider;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockS3Send.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// localDriver
// ---------------------------------------------------------------------------
describe('localDriver', () => {
  const USER_ID = 'user-123';
  const FILE_ID = 'file-abc';
  const EXT = 'pdf';
  const BUFFER = Buffer.from('test content');

  test('upload chama mkdir e writeFile corretamente', async () => {
    const result = await localDriver.upload({ userId: USER_ID, fileId: FILE_ID, ext: EXT, buffer: BUFFER });

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining(USER_ID),
      { recursive: true },
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining(`${FILE_ID}.${EXT}`),
      BUFFER,
    );
    expect(result).toMatchObject({
      storagePath: expect.stringContaining(`${FILE_ID}.${EXT}`),
      url: expect.stringContaining(`${FILE_ID}.${EXT}`),
    });
  });

  test('delete chama unlink com o storagePath', async () => {
    await localDriver.delete({ storagePath: '/tmp/test-uploads/user-123/file.pdf' });

    expect(mockUnlink).toHaveBeenCalledWith('/tmp/test-uploads/user-123/file.pdf');
  });

  test('delete silencia erro ENOENT', async () => {
    const enoentError = Object.assign(new Error('not found'), { code: 'ENOENT' });
    mockUnlink.mockRejectedValueOnce(enoentError);

    await expect(localDriver.delete({ storagePath: '/nonexistent/file.pdf' })).resolves.toBeUndefined();
  });

  test('delete propaga erros que não são ENOENT', async () => {
    const permError = Object.assign(new Error('permission denied'), { code: 'EPERM' });
    mockUnlink.mockRejectedValueOnce(permError);

    await expect(localDriver.delete({ storagePath: '/protected/file.pdf' })).rejects.toThrow('permission denied');
  });

  test('getDownloadReference retorna o storagePath', async () => {
    const storagePath = '/tmp/test-uploads/user-123/file.pdf';
    const result = await localDriver.getDownloadReference({ storagePath });

    expect(result).toBe(storagePath);
  });
});

// ---------------------------------------------------------------------------
// s3Driver
// ---------------------------------------------------------------------------
describe('s3Driver', () => {
  const USER_ID = 'user-123';
  const FILE_ID = 'file-abc';
  const EXT = 'pdf';
  const BUFFER = Buffer.from('test content');
  const MIMETYPE = 'application/pdf';

  test('upload chama PutObjectCommand com os parâmetros corretos', async () => {
    const result = await s3Driver.upload({ userId: USER_ID, fileId: FILE_ID, ext: EXT, buffer: BUFFER, mimetype: MIMETYPE });

    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const command = mockS3Send.mock.calls[0][0];
    expect(command.Bucket).toBe('test-bucket');
    expect(command.Key).toBe(`uploads/${USER_ID}/${FILE_ID}.${EXT}`);
    expect(command.Body).toBe(BUFFER);
    expect(command.ContentType).toBe(MIMETYPE);

    expect(result.storagePath).toBe(`uploads/${USER_ID}/${FILE_ID}.${EXT}`);
    expect(result.url).toBe(`https://test-bucket.s3.amazonaws.com/uploads/${USER_ID}/${FILE_ID}.${EXT}`);
  });

  test('delete chama DeleteObjectCommand', async () => {
    const storagePath = `uploads/${USER_ID}/${FILE_ID}.${EXT}`;
    await s3Driver.delete({ storagePath });

    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const command = mockS3Send.mock.calls[0][0];
    expect(command.Bucket).toBe('test-bucket');
    expect(command.Key).toBe(storagePath);
  });

  test('getDownloadReference retorna URL pública quando S3_PUBLIC_BASE_URL está configurado', async () => {
    const storagePath = `uploads/${USER_ID}/${FILE_ID}.${EXT}`;
    const result = await s3Driver.getDownloadReference({ storagePath });

    expect(result).toBe(`https://test-bucket.s3.amazonaws.com/${storagePath}`);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  test('getDownloadReference gera pre-signed URL quando S3_PUBLIC_BASE_URL não está configurado', async () => {
    // Re-mock config without S3_PUBLIC_BASE_URL
    const configMod = await import('../../config/env.js');
    const originalUrl = configMod.config.S3_PUBLIC_BASE_URL;
    configMod.config.S3_PUBLIC_BASE_URL = undefined;

    const storagePath = `uploads/${USER_ID}/${FILE_ID}.${EXT}`;
    const result = await s3Driver.getDownloadReference({ storagePath });

    expect(result).toBe('https://presigned.url/object');
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

    // Restore
    configMod.config.S3_PUBLIC_BASE_URL = originalUrl;
  });
});

// ---------------------------------------------------------------------------
// getStorageProvider (factory)
// ---------------------------------------------------------------------------
describe('getStorageProvider', () => {
  test('retorna localDriver quando STORAGE_DRIVER=local', async () => {
    const configMod = await import('../../config/env.js');
    configMod.config.STORAGE_DRIVER = 'local';

    const provider = getStorageProvider();
    expect(provider).toBe(localDriver);
  });

  test('retorna s3Driver quando STORAGE_DRIVER=s3', async () => {
    const configMod = await import('../../config/env.js');
    configMod.config.STORAGE_DRIVER = 's3';

    const provider = getStorageProvider();
    expect(provider).toBe(s3Driver);

    // Restore
    configMod.config.STORAGE_DRIVER = 'local';
  });
});
