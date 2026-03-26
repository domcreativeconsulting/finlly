import { calcularPosicao } from '../investimentoService.js';

// ---------------------------------------------------------------------------
// Helper to build event fixtures
// ---------------------------------------------------------------------------
const ev = (tipo, valor) => ({ tipo, valor });

// ---------------------------------------------------------------------------
// calcularPosicao — TASK 09.2.2
// ---------------------------------------------------------------------------
describe('calcularPosicao', () => {
  // AC5 — sem eventos
  describe('AC5 — sem eventos', () => {
    it('retorna posição zerada quando não há eventos', () => {
      const result = calcularPosicao([]);

      expect(result.totalContributed).toBe(0);
      expect(result.totalRedeemed).toBe(0);
      expect(result.totalYield).toBe(0);
      expect(result.currentPosition).toBe(0);
      expect(result.priceAverage).toBeNull();

      // campos legados também zerados
      expect(result.totalAportado).toBe(0);
      expect(result.totalResgatado).toBe(0);
      expect(result.totalRendimentos).toBe(0);
      expect(result.totalTaxas).toBe(0);
      expect(result.totalDividendos).toBe(0);
      expect(result.saldoAtual).toBe(0);
    });
  });

  // AC6 — priceAverage sempre null
  describe('AC6 — preço médio', () => {
    it('retorna priceAverage null mesmo com aportes', () => {
      expect(calcularPosicao([ev('aporte', 5000)]).priceAverage).toBeNull();
    });
  });

  // AC1 — aporte
  describe('AC1 — cálculo de aporte', () => {
    it('soma todos os eventos de tipo aporte em totalContributed e totalAportado', () => {
      const result = calcularPosicao([ev('aporte', 3000), ev('aporte', 2000)]);

      expect(result.totalContributed).toBe(5000);
      expect(result.totalAportado).toBe(5000);
    });

    it('cenário apenas aporte — currentPosition igual ao aporte', () => {
      const result = calcularPosicao([ev('aporte', 10000)]);

      expect(result.totalContributed).toBe(10000);
      expect(result.currentPosition).toBe(10000);
      expect(result.saldoAtual).toBe(10000);
    });
  });

  // AC2 — resgate
  describe('AC2 — cálculo de resgate', () => {
    it('soma todos os eventos de tipo resgate em totalRedeemed e totalResgatado', () => {
      const result = calcularPosicao([ev('aporte', 5000), ev('resgate', 1000), ev('resgate', 500)]);

      expect(result.totalRedeemed).toBe(1500);
      expect(result.totalResgatado).toBe(1500);
    });

    it('cenário aporte + resgate — currentPosition = aporte - resgate', () => {
      const result = calcularPosicao([ev('aporte', 5000), ev('resgate', 2000)]);

      expect(result.currentPosition).toBe(3000);
      expect(result.saldoAtual).toBe(3000);
    });
  });

  // AC3 — rendimento
  describe('AC3 — cálculo de rendimento', () => {
    it('soma todos os eventos de tipo rendimento em totalYield e totalRendimentos', () => {
      const result = calcularPosicao([ev('aporte', 5000), ev('rendimento', 200), ev('rendimento', 50.5)]);

      expect(result.totalYield).toBe(250.5);
      expect(result.totalRendimentos).toBe(250.5);
    });

    it('cenário aporte + rendimento — currentPosition = aporte + rendimento', () => {
      const result = calcularPosicao([ev('aporte', 10000), ev('rendimento', 450.5)]);

      expect(result.currentPosition).toBe(10450.5);
      expect(result.saldoAtual).toBe(10450.5);
    });
  });

  // AC4 — posição atual com combinações completas
  describe('AC4 — posição atual', () => {
    it('cenário aporte + rendimento + resgate', () => {
      const result = calcularPosicao([ev('aporte', 10000), ev('rendimento', 450.5), ev('resgate', 2000)]);

      expect(result.currentPosition).toBe(8450.5);
      expect(result.saldoAtual).toBe(8450.5);
    });

    it('cenário aporte + rendimento + resgate + taxa + dividendo', () => {
      const result = calcularPosicao([
        ev('aporte', 10000),
        ev('rendimento', 450.5),
        ev('resgate', 2000),
        ev('taxa', 50),
        ev('dividendo', 120),
      ]);

      // currentPosition = 10000 + 450.5 + 120 - 2000 - 50 = 8520.5
      expect(result.currentPosition).toBe(8520.5);
      expect(result.saldoAtual).toBe(8520.5);
      expect(result.totalTaxas).toBe(50);
      expect(result.totalDividendos).toBe(120);
    });

    it('campos legados e padronizados são iguais (espelhados)', () => {
      const result = calcularPosicao([ev('aporte', 10000), ev('rendimento', 450.5), ev('resgate', 2000), ev('taxa', 50), ev('dividendo', 120)]);

      expect(result.totalContributed).toBe(result.totalAportado);
      expect(result.totalRedeemed).toBe(result.totalResgatado);
      expect(result.totalYield).toBe(result.totalRendimentos);
      expect(result.currentPosition).toBe(result.saldoAtual);
    });
  });

  // AC7 — função pura (sem efeitos colaterais)
  describe('AC7 — função pura e reutilizável', () => {
    it('produz resultado idêntico independentemente da ordem dos eventos', () => {
      const eventos = [ev('rendimento', 450.5), ev('resgate', 2000), ev('aporte', 10000), ev('dividendo', 120), ev('taxa', 50)];
      const eventosOrdenados = [ev('aporte', 10000), ev('rendimento', 450.5), ev('resgate', 2000), ev('taxa', 50), ev('dividendo', 120)];

      const r1 = calcularPosicao(eventos);
      const r2 = calcularPosicao(eventosOrdenados);

      expect(r1.currentPosition).toBe(r2.currentPosition);
      expect(r1.totalContributed).toBe(r2.totalContributed);
    });

    it('não modifica o array de entrada', () => {
      const eventos = [ev('aporte', 5000), ev('resgate', 1000)];
      const copia = [...eventos];
      calcularPosicao(eventos);
      expect(eventos).toEqual(copia);
    });

    it('não possui dependência de Prisma ou I/O — é chamável de forma síncrona', () => {
      expect(() => calcularPosicao([])).not.toThrow();
      const result = calcularPosicao([ev('aporte', 100)]);
      expect(typeof result).toBe('object');
    });
  });

  // Precisão monetária
  describe('Precisão monetária (Subtask F)', () => {
    it('não retorna mais de 2 casas decimais', () => {
      const result = calcularPosicao([ev('aporte', 0.1), ev('aporte', 0.2)]);

      // 0.1 + 0.2 em float é 0.30000000000000004 — round2 deve corrigir para 0.30
      expect(result.totalContributed).toBe(0.3);
      expect(result.totalAportado).toBe(0.3);
    });

    it('arredonda saldoAtual para 2 casas decimais', () => {
      const result = calcularPosicao([ev('aporte', 10000), ev('rendimento', 333.333), ev('resgate', 100)]);

      // 333.333 arredondado para 2 casas = 333.33; saldoAtual = 10000 + 333.33 - 100 = 10233.33
      const decimaisPosition = (result.currentPosition.toString().split('.')[1] ?? '').length;
      expect(decimaisPosition).toBeLessThanOrEqual(2);
    });
  });
});
