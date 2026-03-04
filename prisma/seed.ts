import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ============================================================
// Dados de seed
// ============================================================

const tiposInvestimento = [
  { nome: 'CDB', descricao: 'Certificado de Depósito Bancário' },
  { nome: 'LCI', descricao: 'Letra de Crédito Imobiliário' },
  { nome: 'LCA', descricao: 'Letra de Crédito do Agronegócio' },
  { nome: 'Tesouro Direto', descricao: 'Títulos públicos federais' },
  {
    nome: 'Ações',
    descricao: 'Renda variável — ações de empresas listadas em bolsa',
  },
  { nome: 'FII', descricao: 'Fundos de Investimento Imobiliário' },
  { nome: 'ETF', descricao: 'Exchange Traded Fund — fundo negociado em bolsa' },
  { nome: 'Poupança', descricao: 'Caderneta de poupança' },
  { nome: 'Debêntures', descricao: 'Títulos de dívida corporativa' },
  { nome: 'Criptomoedas', descricao: 'Ativos digitais descentralizados' },
  {
    nome: 'Fundo de Renda Fixa',
    descricao: 'Fundos de investimento em renda fixa',
  },
  {
    nome: 'Fundo Multimercado',
    descricao: 'Fundos com estratégia em múltiplos mercados',
  },
];

// Categorias do sistema (usuario_id = NULL, is_sistema = TRUE)
const categoriasSistema: Array<{
  nome: string;
  tipo: 'entrada' | 'saida';
}> = [
  // Entradas
  { nome: 'Salário', tipo: 'entrada' },
  { nome: 'Freelance', tipo: 'entrada' },
  { nome: 'Rendimento de Investimento', tipo: 'entrada' },
  { nome: 'Transferência recebida', tipo: 'entrada' },
  { nome: 'Presente', tipo: 'entrada' },
  { nome: 'Outros — Entrada', tipo: 'entrada' },
  // Saídas
  { nome: 'Alimentação', tipo: 'saida' },
  { nome: 'Transporte', tipo: 'saida' },
  { nome: 'Moradia', tipo: 'saida' },
  { nome: 'Saúde', tipo: 'saida' },
  { nome: 'Educação', tipo: 'saida' },
  { nome: 'Lazer', tipo: 'saida' },
  { nome: 'Vestuário', tipo: 'saida' },
  { nome: 'Assinaturas e Serviços', tipo: 'saida' },
  { nome: 'Impostos e Taxas', tipo: 'saida' },
  { nome: 'Outros — Saída', tipo: 'saida' },
];

// ============================================================
// Seed principal
// ============================================================

async function main() {
  console.log('🌱 Iniciando seed...');

  // ----------------------------------------------------------
  // 1. tipos_investimento — idempotente via upsert
  // ----------------------------------------------------------
  let tiposInseridos = 0;
  for (const tipo of tiposInvestimento) {
    await prisma.tipoInvestimento.upsert({
      where: { nome: tipo.nome },
      update: { descricao: tipo.descricao },
      create: tipo,
    });
    tiposInseridos++;
  }
  console.log(`✅ ${tiposInseridos} tipos de investimento sincronizados`);

  // ----------------------------------------------------------
  // 2. categorias do sistema — idempotente por verificação
  // ----------------------------------------------------------
  const existentes = await prisma.categoria.findMany({
    where: { is_sistema: true },
    select: { nome: true, tipo: true },
  });

  const existentesSet = new Set(existentes.map((c) => `${c.nome}::${c.tipo}`));

  let categoriasInseridas = 0;
  for (const cat of categoriasSistema) {
    const chave = `${cat.nome}::${cat.tipo}`;
    if (!existentesSet.has(chave)) {
      await prisma.categoria.create({
        data: {
          nome: cat.nome,
          tipo: cat.tipo,
          is_sistema: true,
          usuario_id: null,
        },
      });
      categoriasInseridas++;
    }
  }
  console.log(
    `✅ ${categoriasInseridas} categorias do sistema inseridas (${existentes.length} já existiam)`
  );

  console.log('✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
