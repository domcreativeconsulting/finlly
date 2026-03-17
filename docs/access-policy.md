# Finlly API — Access Policy

## Introduction

The Finlly API uses a three-tier access model to control which endpoints each client can reach depending on authentication state and subscription status.

All access rules are **declared centrally** in [`apps/api/src/config/accessPolicy.js`](../apps/api/src/config/accessPolicy.js). The enforcement is done by two Express middleware layers:

1. **`jwtAuthMiddleware`** — validates the JWT and populates `req.user`. Required for all non-public routes.
2. **`requireAtivo`** — rejects requests from users whose subscription status is blocked (see [Status de Usuário](#status-de-usuário)). Applied only to **Paid** routes.

---

## Níveis de Acesso

| Nível | Autenticação | Restrição de plano | Middleware aplicado |
|-------|-------------|-------------------|---------------------|
| **Public** | ❌ Não necessária | ❌ Nenhuma | Nenhum (ou HMAC para webhooks) |
| **Free** | ✅ JWT obrigatório | ❌ Nenhuma | `jwtAuthMiddleware` |
| **Paid** | ✅ JWT obrigatório | ✅ Assinatura ativa | `jwtAuthMiddleware` + `requireAtivo` |

---

## Tabela de Rotas

| Método | Rota | Nível | Exceção / Observação |
|--------|------|-------|----------------------|
| `GET` | `/health` | Public | — |
| `POST` | `/auth/register` | Public | — |
| `POST` | `/auth/login` | Public | — |
| `POST` | `/auth/refresh` | Public | — |
| `POST` | `/auth/forgot-password` | Public | — |
| `POST` | `/auth/reset-password` | Public | — |
| `POST` | `/auth/verify-email` | Public | — |
| `POST` | `/auth/resend-verification-email` | Public | — |
| `POST` | `/webhooks/asaas` | Public | Autenticado por HMAC, não por JWT |
| `POST` | `/auth/logout` | Free | — |
| `GET` | `/auth/me` | Free | — |
| `GET` | `/perfil` | Free | Leitura sempre permitida; apenas escrita é bloqueada |
| `GET` | `/users/me` | Free | Alias de `GET /perfil` |
| `GET` | `/billing/status` | Free | Inadimplente precisa poder ver seu status |
| `POST` | `/billing/cancel` | Free | Inadimplente precisa poder cancelar |
| `POST` | `/billing/admin/reconciliar` | Free | Restrito por `role=admin`, não por plano |
| `POST` | `/billing/subscribe` | Paid | — |
| `PATCH` | `/perfil` | Paid | — |
| `PUT` | `/users/me` | Paid | Alias de `PATCH /perfil` |

---

## Status de Usuário

O campo `status` em `req.user` (populado pelo `jwtAuthMiddleware`) determina se um usuário pode acessar rotas **Paid**.

| Status | Descrição | Acesso a rotas Paid |
|--------|-----------|---------------------|
| `ativo` | Assinatura ativa e em dia | ✅ Permitido |
| `trial` | Período de avaliação gratuita | ✅ Permitido |
| `pendente` | Aguardando confirmação de pagamento | ✅ Permitido |
| `bloqueado_inadimplencia` | Inadimplente — pagamento em atraso | ❌ **Bloqueado** (HTTP 403) |

A lista autoritativa de status bloqueados está em `BLOCKED_STATUSES` no arquivo [`accessPolicy.js`](../apps/api/src/config/accessPolicy.js). Qualquer alteração na regra deve ser feita **apenas** nesse arquivo.

Quando um status bloqueado é detectado, o middleware `requireAtivo` retorna:

```json
{
  "code": "INADIMPLENTE",
  "message": "Sua assinatura está inadimplente. Regularize seu pagamento para continuar usando o serviço.",
  "statusCode": 403
}
```

---

## Regras de Exceção

### Por que `/billing/cancel` é Free?

Um usuário com status `bloqueado_inadimplencia` deve poder cancelar sua assinatura sem ser impedido pelo `requireAtivo`. Bloquear o cancelamento criaria um estado sem saída para o usuário. Por isso, `POST /billing/cancel` usa apenas `jwtAuthMiddleware`, sem `requireAtivo`.

### Por que `/billing/status` é Free?

O usuário precisa poder consultar seu próprio status de assinatura (inclusive para saber que está inadimplente e o que fazer). Bloquear essa rota impediria o cliente de obter as informações necessárias para regularizar a situação.

### Por que `GET /perfil` e `GET /users/me` são Free?

A regra de negócio é que **leitura** de dados próprios é sempre permitida; apenas **escrita** (`PATCH /perfil`, `PUT /users/me`) exige assinatura ativa. Isso garante que o usuário sempre consiga ver seus dados, mesmo em estado de inadimplência.

### Por que `/billing/admin/reconciliar` é Free (sem `requireAtivo`)?

Essa rota é restrita por `role === 'admin'` no próprio handler, não por plano de assinatura. Administradores operam o sistema independentemente de status de assinatura, portanto `requireAtivo` não se aplica.

---

## Como aplicar a policy em novas rotas

### 1. Identifique o nível da nova rota

| Situação | Nível |
|----------|-------|
| Rota pública, sem dados do usuário | **Public** |
| Rota que precisa saber quem é o usuário, mas não restringe por plano | **Free** |
| Rota que exige assinatura ativa para funcionar | **Paid** |

### 2. Aplique os middleware corretos no router

```javascript
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';

// Public — sem middleware de autenticação
router.get('/public-endpoint', handler);

// Free — apenas autenticação
router.get('/free-endpoint', jwtAuthMiddleware, handler);

// Paid — autenticação + verificação de status ativo
router.post('/paid-endpoint', jwtAuthMiddleware, requireAtivo, handler);
```

### 3. Declare a nova rota em `accessPolicy.js`

Adicione uma entrada na lista correspondente (`PUBLIC_ROUTES`, `FREE_ROUTES` ou `PAID_ROUTES`) no arquivo [`apps/api/src/config/accessPolicy.js`](../apps/api/src/config/accessPolicy.js):

```javascript
// Exemplo: nova rota paid
export const PAID_ROUTES = Object.freeze([
  // ... rotas existentes ...
  {
    method: 'POST',
    path: '/nova-rota',
    description: 'Descrição clara do que essa rota faz.',
  },
]);
```

### 4. Atualize esta documentação

Adicione a nova rota à [Tabela de Rotas](#tabela-de-rotas) acima, especificando o método, caminho, nível e eventuais exceções.

---

## Nota: Rota Legada `POST /usuarios`

O arquivo [`apps/api/src/routes/usuarios.js`](../apps/api/src/routes/usuarios.js) define uma rota `POST /usuarios` que replica a funcionalidade de `POST /auth/register`. **Esta rota não está registrada no `index.js`** e, portanto, não está disponível na aplicação em produção. Ela é considerada código legado e não deve ser utilizada. A rota canônica para registro de usuários é `POST /auth/register`.
