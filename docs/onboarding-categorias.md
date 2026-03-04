# Fluxo de Onboarding de Categorias

## Visão Geral

Quando um novo usuário se registra no Finlly:

1. **Criação do Usuário** — `POST /usuarios` valida dados e cria usuário
2. **Criação de Categorias Default** — 16 categorias padrão são copiadas para o usuário
3. **Transação Atômica** — usuário + categorias são criados juntos ou não criados

## Fluxo Detalhado

```
┌─────────────────────────────────────┐
│ POST /usuarios                      │
│ { nome, email, senha }              │
└────────────────┬────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ registerUser()│
         └───────┬───────┘
                 │
         ┌───────▼─────────────────────────────────┐
         │ prisma.$transaction(async (tx) => {     │
         │   1. Criar usuário                       │
         │   2. Copiar 16 categorias do template    │
         │   3. Return { usuario, categorias_criadas }│
         │ })                                       │
         └───────┬─────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │ Sucesso                 │ Erro
    ▼                         ▼
┌──────────┐          ┌──────────────┐
│ 201 JSON │          │ Rollback     │
│ usuario  │          │ Nada criado  │
└──────────┘          └──────────────┘
```

## Categorias Default (Template)

16 categorias pré-definidas são criadas pelo seed como template (`is_sistema=true, usuario_id=NULL`).

Ao registrar, essas 16 são copiadas para o novo usuário:

**Entradas (6):**
- Salário
- Freelance
- Rendimento de Investimento
- Transferência recebida
- Presente
- Outros — Entrada

**Saídas (10):**
- Alimentação
- Transporte
- Moradia
- Saúde
- Educação
- Lazer
- Vestuário
- Assinaturas e Serviços
- Impostos e Taxas
- Outros — Saída

## Idempotência

O constraint UNIQUE `(usuario_id, nome, tipo)` garante que:

- Rodar o seed 2x não cria categorias de sistema duplicadas
- Cada combinação (usuário, nome, tipo) é única por usuário
- `createMany({ skipDuplicates: true })` ignora inserções duplicadas com segurança

## Exemplo de Uso

```bash
# Registrar novo usuário
curl -X POST http://localhost:3000/usuarios \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "email": "joao@example.com",
    "senha": "senha-segura-8+"
  }'

# Resposta
{
  "message": "Usuário criado com sucesso",
  "usuario": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nome": "João Silva",
    "email": "joao@example.com",
    "created_at": "2026-03-04T10:30:00Z",
    "categorias_criadas": 16
  }
}
```

O usuário já terá 16 categorias associadas, retornadas com queries posteriores.

## Testando Idempotência

```bash
# Rodar seed 2x deve ser seguro
npx prisma db seed
npx prisma db seed
# ✅ Sem erros de constraint
```
