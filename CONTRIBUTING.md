# Guia de Contribuição — Finlly

Bem-vindo ao Finlly. Este guia cobre tudo o que você precisa saber para contribuir com o projeto.

---

## Pré-requisitos

- **Node.js** 20.x (LTS)
- **npm** 10.x
- **Docker** e **Docker Compose** (para banco de dados local)
- **Git**

Variáveis de ambiente: copie `.env.example` para `.env` e preencha os valores necessários.

---

## Setup do ambiente de desenvolvimento

```bash
# 1. Clone o repositório
git clone https://github.com/domcreativeconsulting/finlly.git
cd finlly

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações locais

# 4. Suba o banco de dados local
docker compose up -d

# 5. Execute as migrations
npm run db:migrate

# 6. (Opcional) Popule com dados iniciais
npm run db:seed

# 7. Inicie a API em modo desenvolvimento
npm run dev --workspace=apps/api
```

---

## Padrão de branches

Use o seguinte formato para nomear branches:

```
<tipo>/<número-da-issue>-<descrição-curta>
```

| Tipo | Quando usar |
|------|------------|
| `feat/` | Nova funcionalidade |
| `fix/` | Correção de bug |
| `chore/` | Manutenção, dependências, configuração |
| `docs/` | Documentação |
| `test/` | Testes |
| `refactor/` | Refatoração sem mudança de comportamento |

**Exemplos:**
```
feat/42-notificacao-vencimento-assinatura
fix/78-erro-500-webhook-asaas
docs/16-definition-of-done
test/16-cobertura-billing
```

---

## Conventional Commits

Todos os commits devem seguir o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo>): <descrição>
```

**Tipos aceitos:**

| Tipo | Descrição |
|------|-----------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Mudança em documentação |
| `test` | Adição ou correção de testes |
| `refactor` | Refatoração sem mudança de comportamento |
| `chore` | Manutenção, dependências, build |
| `perf` | Melhoria de performance |
| `ci` | Mudanças em CI/CD |

**Exemplos:**
```
feat(billing): adicionar notificação de vencimento de assinatura
fix(webhook): tratar idempotência em eventos duplicados do Asaas
test(whatsapp): cobrir normalização de payload da Evolution API
docs(dod): criar definition of done e templates de PR e issue
chore(deps): atualizar jest para v30
```

---

## Fluxo de PR

1. **Crie uma branch** a partir de `main` seguindo o padrão de branches
2. **Implemente** as mudanças
3. **Escreva testes** para o que foi implementado
4. **Rode lint e testes** localmente:
   ```bash
   npm run lint
   npm run test
   ```
5. **Faça commit** seguindo Conventional Commits
6. **Abra o PR** usando o [template de PR](.github/pull_request_template.md)
7. **Preencha o checklist** do PR template
8. **Aguarde review** — ao menos 1 aprovação é necessária para merge
9. **CI deve estar verde** — lint, test e build devem passar

---

## Definition of Done

Antes de marcar qualquer entrega como pronta, verifique os critérios em:

**[docs/DEFINITION-OF-DONE.md](docs/DEFINITION-OF-DONE.md)**

Resumo rápido por tipo de entrega:

- **TASK**: código funcionando, sem debug/secrets, lint/build passando, testes unitários
- **STORY**: tudo de task + testes de integração, tratamento de erro, auditoria, documentação, review
- **EPIC**: tudo de story + cobertura mínima no CI, regressões cobertas, docs atualizadas

---

## Executando testes

```bash
# Todos os testes da API
npm run test

# Testes com relatório de cobertura
cd apps/api && npm run test:coverage

# Testes em modo watch (desenvolvimento)
cd apps/api && npm run test -- --watch
```

A cobertura mínima exigida para os módulos críticos é de **60%** em branches, functions, lines e statements.

---

## Linting e formatação

```bash
# Verificar problemas de lint
npm run lint

# Corrigir automaticamente
npm run lint:fix

# Verificar formatação
npm run format:check

# Aplicar formatação
npm run format
```

O projeto usa [ESLint](eslint.config.js) e [Prettier](.prettierrc.json). O Husky garante que lint-staged rode antes de cada commit.

---

## Módulos críticos

Dê atenção especial ao trabalhar nos seguintes módulos — eles afetam diretamente a receita e a integridade dos dados:

| Módulo | Localização | Por que é crítico |
|--------|-------------|------------------|
| 💳 Billing | `apps/api/src/services/billing*.js` | Afeta receita e status de assinaturas |
| 🔔 Webhooks | `apps/api/src/services/webhook*.js` | Sincronização de estado com Asaas e Evolution |
| 📱 WhatsApp Agent | `apps/api/src/services/whatsapp*.js`, `src/lib/whatsapp/` | Automação de operações financeiras via chat |
| 🔐 Autenticação | `apps/api/src/middleware/auth*.js`, `src/services/auth*.js` | Controle de acesso ao sistema |

Mudanças nesses módulos exigem cobertura de testes e revisão mais cuidadosa.

---

## Dúvidas?

Abra uma [issue](https://github.com/domcreativeconsulting/finlly/issues/new/choose) usando o template adequado.
