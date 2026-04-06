/**
 * Gera CSV a partir de headers e linhas
 * @param {string[]} headers - Array de nomes das colunas (deve ter pelo menos 1 item)
 * @param {string[][]} rows - Array de arrays de valores; cada sub-array deve ter o mesmo comprimento que headers
 * @returns {string} CSV com BOM UTF-8 para compatibilidade com Excel
 */
export function gerarCSV(headers, rows) {
  function escapeField(value) {
    const str = value == null ? '' : String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const lines = [
    headers.map(escapeField).join(','),
    ...rows.map((row) => row.map(escapeField).join(',')),
  ];

  return '\uFEFF' + lines.join('\n');
}
