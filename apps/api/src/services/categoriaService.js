import prisma from '../lib/prisma.js';

export const categoriasSistema = [
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

/**
 * Creates default financial categories for a new user (idempotent).
 * Checks existing categories by usuario_id + nome + tipo to avoid duplicates.
 *
 * @param {string} usuarioId - UUID of the user
 * @param {import('@prisma/client').PrismaClient} prismaClient - Prisma client (default: shared instance)
 * @returns {Promise<number>} Number of categories created
 */
export async function createDefaultCategoriesForUser(usuarioId, prismaClient = prisma) {
  const existentes = await prismaClient.categoria.findMany({
    where: { usuario_id: usuarioId, is_sistema: true },
    select: { nome: true, tipo: true },
  });

  const existentesSet = new Set(existentes.map((c) => `${c.nome}::${c.tipo}`));

  let criadas = 0;
  for (const cat of categoriasSistema) {
    const chave = `${cat.nome}::${cat.tipo}`;
    if (!existentesSet.has(chave)) {
      await prismaClient.categoria.create({
        data: {
          nome: cat.nome,
          tipo: cat.tipo,
          is_sistema: true,
          usuario_id: usuarioId,
        },
      });
      criadas++;
    }
  }

  return criadas;
}
