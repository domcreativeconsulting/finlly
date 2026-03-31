/**
 * Interface de storage. Todos os drivers devem implementar estes métodos.
 *
 * upload({ userId, fileId, ext, buffer, mimetype }) => Promise<{ storagePath, url }>
 *   Armazena o arquivo e retorna o caminho de armazenamento e a URL de acesso.
 *
 * delete({ storagePath }) => Promise<void>
 *   Remove o arquivo do storage. Deve silenciar erros de arquivo não encontrado.
 *
 * getDownloadReference({ storagePath }) => Promise<string>
 *   Retorna uma URL ou path seguro para acesso ao arquivo.
 */
