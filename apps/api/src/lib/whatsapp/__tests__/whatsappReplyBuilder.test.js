import {
  replyDespesaRegistrada,
  replyReceitaRegistrada,
  replyContaPagarRegistrada,
  replyContaPaga,
  replySemContasPendentes,
  replySaldo,
  replyExtrato,
  replyExtratoVazio,
  replyInvestimentoRegistrado,
  replyErroSemConta,
  replyErroGenerico,
  replyRateLimitExcedido,
  replyValorNaoIdentificado,
  replyContaSuspensa,
  replyNumeroNaoVinculado,
  replyUnknown,
} from '../whatsappReplyBuilder.js';

// ============================================================
// replyDespesaRegistrada
// ============================================================

describe('replyDespesaRegistrada', () => {
  const base = {
    nome: 'João',
    valor: 50,
    descricao: 'almoço',
    conta: 'Conta Corrente',
    data: '2026-04-04',
    totalSemana: 320,
    saldo: 500,
  };

  test('contém nome do usuário', () => {
    expect(replyDespesaRegistrada(base)).toContain('João');
  });

  test('contém valor formatado', () => {
    expect(replyDespesaRegistrada(base)).toContain('R$ 50,00');
  });

  test('contém conta', () => {
    expect(replyDespesaRegistrada(base)).toContain('Conta Corrente');
  });

  test('contém total da semana formatado', () => {
    expect(replyDespesaRegistrada(base)).toContain('R$ 320,00');
  });

  test('começa com emoji de sucesso', () => {
    expect(replyDespesaRegistrada(base)).toContain('✅ Despesa registrada, João!');
  });

  test('sem alerta quando saldo está OK (>= R$ 100)', () => {
    expect(replyDespesaRegistrada({ ...base, saldo: 500 })).not.toContain('⚠️');
  });

  test('alerta de saldo baixo quando saldo < 100 e >= 0', () => {
    const msg = replyDespesaRegistrada({ ...base, saldo: 45 });
    expect(msg).toContain('⚠️ Atenção: seu saldo está baixo (R$ 45,00).');
  });

  test('alerta de saldo negativo quando saldo < 0', () => {
    const msg = replyDespesaRegistrada({ ...base, saldo: -50 });
    expect(msg).toContain('⚠️ Atenção: seu saldo está negativo (R$ -50,00).');
  });

  test('data formatada como dd/mm/aaaa', () => {
    expect(replyDespesaRegistrada(base)).toContain('04/04/2026');
  });
});

// ============================================================
// replyReceitaRegistrada
// ============================================================

describe('replyReceitaRegistrada', () => {
  test('contém nome, valor e conta', () => {
    const msg = replyReceitaRegistrada({
      nome: 'Maria',
      valor: 2000,
      descricao: 'cliente X',
      conta: 'Poupança',
      data: '2026-04-04',
    });
    expect(msg).toContain('✅ Receita registrada, Maria!');
    expect(msg).toContain('R$ 2.000,00');
    expect(msg).toContain('Poupança');
    expect(msg).toContain('cliente X');
  });

  test('data formatada como dd/mm/aaaa', () => {
    const msg = replyReceitaRegistrada({
      nome: 'Ana',
      valor: 500,
      descricao: 'freela',
      conta: 'Corrente',
      data: '2026-01-15',
    });
    expect(msg).toContain('15/01/2026');
  });
});

// ============================================================
// replyContaPagarRegistrada
// ============================================================

describe('replyContaPagarRegistrada', () => {
  const base = { descricao: 'Conta de Luz', valor: 150, dataVencimento: '2026-04-15' };

  test('contém emoji de conta a pagar', () => {
    expect(replyContaPagarRegistrada(base)).toContain('📋 Conta a pagar registrada!');
  });

  test('contém valor formatado', () => {
    expect(replyContaPagarRegistrada(base)).toContain('R$ 150,00');
  });

  test('contém descrição', () => {
    expect(replyContaPagarRegistrada(base)).toContain('Conta de Luz');
  });

  test('contém data de vencimento formatada', () => {
    expect(replyContaPagarRegistrada(base)).toContain('15/04/2026');
  });

  test('contém CTA com nome da conta', () => {
    const msg = replyContaPagarRegistrada(base);
    expect(msg).toContain('paguei a Conta de Luz');
    expect(msg).toContain('acesse o Finlly');
  });
});

// ============================================================
// replyContaPaga
// ============================================================

describe('replyContaPaga', () => {
  test('contém descrição, valor e data', () => {
    const msg = replyContaPaga({
      descricao: 'Aluguel',
      valor: 1200,
      data: '2026-04-01',
    });
    expect(msg).toContain('✅ Conta paga!');
    expect(msg).toContain('Aluguel');
    expect(msg).toContain('R$ 1.200,00');
    expect(msg).toContain('01/04/2026');
  });
});

// ============================================================
// replySemContasPendentes
// ============================================================

describe('replySemContasPendentes', () => {
  test('retorna mensagem com emoji de comemoração', () => {
    const msg = replySemContasPendentes();
    expect(msg).toContain('✅ Você não tem contas pendentes no momento.');
    expect(msg).toContain('Ótimo trabalho!');
    expect(msg).toContain('🎉');
  });
});

// ============================================================
// replySaldo
// ============================================================

describe('replySaldo', () => {
  test('contém nome, saldo, entradas e saídas formatados', () => {
    const msg = replySaldo({ nome: 'Carlos', saldo: 1234.56, entradas: 5000, saidas: 3765.44 });
    expect(msg).toContain('💰 Saldo de Carlos');
    expect(msg).toContain('R$ 1.234,56');
    expect(msg).toContain('R$ 5.000,00');
    expect(msg).toContain('R$ 3.765,44');
  });
});

// ============================================================
// replyExtrato
// ============================================================

describe('replyExtrato', () => {
  const items = [
    { type: 'OUT', description: 'Almoço', amount: 50 },
    { type: 'IN', description: 'Freela', amount: 500 },
  ];

  test('contém nome, período, itens e totais', () => {
    const msg = replyExtrato({ nome: 'João', periodo: 'semana', items, totalIn: 500, totalOut: 50 });
    expect(msg).toContain('📊 Extrato da semana — João');
    expect(msg).toContain('🔴 Almoço');
    expect(msg).toContain('💚 Freela');
    expect(msg).toContain('R$ 500,00');
    expect(msg).toContain('Total de entradas');
    expect(msg).toContain('Total de saídas');
  });

  test('usa 🔴 para saídas e 💚 para entradas', () => {
    const msg = replyExtrato({ nome: 'Ana', periodo: 'mês', items, totalIn: 500, totalOut: 50 });
    expect(msg).toContain('🔴 Almoço — R$ 50,00');
    expect(msg).toContain('💚 Freela — R$ 500,00');
  });
});

// ============================================================
// replyExtratoVazio
// ============================================================

describe('replyExtratoVazio', () => {
  test('retorna mensagem de extrato vazio', () => {
    expect(replyExtratoVazio()).toBe('📊 Nenhuma movimentação encontrada no período.');
  });
});

// ============================================================
// replyInvestimentoRegistrado
// ============================================================

describe('replyInvestimentoRegistrado', () => {
  test('contém nome, valor e conta', () => {
    const msg = replyInvestimentoRegistrado({
      nome: 'Pedro',
      valor: 1000,
      descricao: 'Tesouro Direto',
      conta: 'Conta Corrente',
      data: '2026-04-04',
    });
    expect(msg).toContain('📈 Investimento registrado, Pedro!');
    expect(msg).toContain('R$ 1.000,00');
    expect(msg).toContain('Conta Corrente');
    expect(msg).toContain('Tesouro Direto');
  });
});

// ============================================================
// replyErroSemConta
// ============================================================

describe('replyErroSemConta', () => {
  test('contém "conta" e "Finlly"', () => {
    const msg = replyErroSemConta();
    expect(msg).toContain('conta');
    expect(msg).toContain('Finlly');
  });

  test('começa com emoji de erro', () => {
    expect(replyErroSemConta()).toContain('❌');
  });

  test('inclui instrução de CTA', () => {
    expect(replyErroSemConta()).toContain('🔗');
  });
});

// ============================================================
// replyErroGenerico
// ============================================================

describe('replyErroGenerico', () => {
  test('retorna mensagem de erro genérico com emoji', () => {
    const msg = replyErroGenerico();
    expect(msg).toContain('❌');
    expect(msg).toContain('Tente novamente');
  });
});

// ============================================================
// replyRateLimitExcedido
// ============================================================

describe('replyRateLimitExcedido', () => {
  test('contém emoji de espera e instrução', () => {
    const msg = replyRateLimitExcedido();
    expect(msg).toContain('⏳');
    expect(msg).toContain('Aguarde');
  });
});

// ============================================================
// replyValorNaoIdentificado
// ============================================================

describe('replyValorNaoIdentificado', () => {
  test('contém emoji e dica de uso', () => {
    const msg = replyValorNaoIdentificado();
    expect(msg).toContain('🤔');
    expect(msg).toContain('valor');
    expect(msg).toContain('gastei 50');
  });
});

// ============================================================
// replyContaSuspensa
// ============================================================

describe('replyContaSuspensa', () => {
  test('contém emoji de bloqueio e canal de suporte', () => {
    const msg = replyContaSuspensa();
    expect(msg).toContain('⛔');
    expect(msg).toContain('suspensa');
    expect(msg).toContain('suporte@finlly.com.br');
  });
});

// ============================================================
// replyNumeroNaoVinculado
// ============================================================

describe('replyNumeroNaoVinculado', () => {
  test('contém saudação e instruções de vinculação', () => {
    const msg = replyNumeroNaoVinculado();
    expect(msg).toContain('👋');
    expect(msg).toContain('Finlly');
    expect(msg).toContain('WhatsApp');
  });
});

// ============================================================
// replyUnknown
// ============================================================

describe('replyUnknown', () => {
  test('contém emoji de robô e exemplos de comandos', () => {
    const msg = replyUnknown();
    expect(msg).toContain('🤖');
    expect(msg).toContain('gastei');
    expect(msg).toContain('recebi');
    expect(msg).toContain('saldo');
  });
});
