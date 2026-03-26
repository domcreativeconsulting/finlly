/**
 * @param {number} n
 * @returns {number}
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula a posição consolidada de um investimento a partir de seus eventos.
 *
 * Retorna campos legados (pt-BR) para compatibilidade com os endpoints existentes
 * e campos padronizados (en) introduzidos pela TASK 09.2.2.
 *
 * @param {Array<{ tipo: string, valor: number|string }>} eventos
 * @returns {{
 *   totalAportado: number,
 *   totalResgatado: number,
 *   totalRendimentos: number,
 *   totalTaxas: number,
 *   totalDividendos: number,
 *   saldoAtual: number,
 *   totalContributed: number,
 *   totalRedeemed: number,
 *   totalYield: number,
 *   currentPosition: number,
 *   priceAverage: null,
 * }}
 */
export function calcularPosicao(eventos) {
  let totalAportado = 0;
  let totalResgatado = 0;
  let totalRendimentos = 0;
  let totalTaxas = 0;
  let totalDividendos = 0;

  for (const ev of eventos) {
    const v = Number(ev.valor);
    if (ev.tipo === 'aporte') totalAportado += v;
    else if (ev.tipo === 'resgate') totalResgatado += v;
    else if (ev.tipo === 'rendimento') totalRendimentos += v;
    else if (ev.tipo === 'taxa') totalTaxas += v;
    else if (ev.tipo === 'dividendo') totalDividendos += v;
  }

  const saldoAtual = totalAportado - totalResgatado + totalRendimentos - totalTaxas + totalDividendos;

  return {
    // campos legados (compatibilidade)
    totalAportado: round2(totalAportado),
    totalResgatado: round2(totalResgatado),
    totalRendimentos: round2(totalRendimentos),
    totalTaxas: round2(totalTaxas),
    totalDividendos: round2(totalDividendos),
    saldoAtual: round2(saldoAtual),

    // campos padronizados (TASK 09.2.2)
    totalContributed: round2(totalAportado),
    totalRedeemed: round2(totalResgatado),
    totalYield: round2(totalRendimentos),
    currentPosition: round2(saldoAtual),
    priceAverage: null,
  };
}
