# Definition of Done — Finlly

> **Versão:** 1.0  
> **Referência:** STORY 16.1 — Qualidade: Testes e critérios de "pronto"

---

## O que é Definition of Done

Definition of Done (DoD) é o conjunto mínimo de critérios objetivos que uma entrega precisa satisfazer para ser considerada **pronta**. Não é uma lista de desejos — é um contrato entre quem desenvolve e quem aceita.

No Finlly, "pronto" significa:

- o código funciona
- o código foi testado
- o código foi revisado
- o comportamento está documentado o suficiente para ser mantido

Qualquer entrega que não satisfaça esses critérios **não está pronta**, independente de estar implementada.

---

## Critérios por tipo de entrega

### TASK

Uma task é a menor unidade de trabalho. Está pronta quando:

**Código**
- [ ] Implementação concluída e funcionando localmente
- [ ] Sem `console.log` ou código de debug
- [ ] Sem segredos, tokens ou credenciais hardcoded
- [ ] Linting passando (`npm run lint`)
- [ ] Build passando (`npm run build`)

**Validação**
- [ ] Input validado com Zod (quando aplicável)
- [ ] Erros tratados com `AppError` e status HTTP correto

**Testes**
- [ ] Testes unitários escritos para a funcionalidade implementada
- [ ] Todos os testes existentes passando (`npm run test`)

**Segurança**
- [ ] Dados sensíveis não expostos em logs ou respostas de erro

---

### STORY

Uma story agrupa um conjunto de tasks que entregam valor de negócio. Está pronta quando:

**Tudo de TASK, mais:**

**Testes**
- [ ] Testes de integração para fluxos críticos cobertos pela story
- [ ] Cenários de erro e edge cases cobertos por testes

**Tratamento de erro**
- [ ] Todos os fluxos de erro mapeados e tratados explicitamente
- [ ] Mensagens de erro claras e sem leak de informação interna

**Auditoria e observabilidade**
- [ ] Logs de auditoria registrados para operações sensíveis (criação, alteração, exclusão de dados financeiros)
- [ ] Logs com contexto suficiente para debugging (requestId, userId, eventType)

**Documentação**
- [ ] Contrato de rota documentado (se novo endpoint ou alteração de contrato existente)
- [ ] Comportamento esperado documentado (se lógica de negócio não óbvia)
- [ ] README ou docs atualizados (se necessário)

**Revisão**
- [ ] PR revisado por ao menos um membro do time
- [ ] Checklist do PR template preenchido

---

### EPIC

Um epic representa um conjunto de stories que entregam uma capacidade completa do sistema. Está pronto quando:

**Tudo de STORY, mais:**

**Cobertura**
- [ ] Cobertura mínima de 60% validada no CI para os módulos do epic (`npm run test:coverage`)
- [ ] Cenários de regressão cobertos nos módulos impactados
- [ ] Fluxos críticos do epic totalmente cobertos por testes

**Documentação**
- [ ] Documentação técnica atualizada (arquitetura, decisões relevantes em `docs/`)
- [ ] Critérios de aceite de negócio do epic validados com o responsável
- [ ] Changelog ou release notes produzidos (se aplicável)

**Qualidade**
- [ ] CI passando em todos os jobs (lint → test → build)
- [ ] Nenhuma regressão introduzida nos módulos existentes

---

## Módulos críticos e cobertura obrigatória

Os módulos abaixo são considerados **críticos** e exigem cobertura de testes antes de qualquer entrega:

### 💳 Billing (`src/services/billing*.js`, `src/routes/billing*.js`)

| Cenário | Tipo de teste |
|---------|--------------|
| Criação de assinatura | Unitário + Integração |
| Webhook Asaas (pagamento confirmado, falha, cancelamento) | Unitário + Contrato |
| Idempotência de webhook | Unitário |
| Bloqueio por inadimplência | Unitário |
| Liberação após pagamento | Unitário |

### 🔔 Webhooks (`src/services/webhook*.js`, `src/routes/webhook*.js`)

| Cenário | Tipo de teste |
|---------|--------------|
| Recebimento e validação de payload | Unitário |
| Idempotência (evento duplicado) | Unitário |
| Retries e falha final | Unitário |
| Atualização de estado após webhook | Integração |

### 📱 WhatsApp Agent (`src/services/whatsapp*.js`, `src/lib/whatsapp/`)

| Cenário | Tipo de teste |
|---------|--------------|
| Recebimento de mensagem (Evolution) | Unitário |
| Normalização de payload | Unitário |
| Identificação de intent | Unitário |
| Execução de ação (criar movimentação, etc.) | Integração |
| Resposta ao usuário | Unitário |

---

## Fluxo de revisão e aceite

```
Desenvolvimento → Lint/Test local → Abrir PR → Review → CI passa → Merge
```

1. **Desenvolvimento**: implementar, testar localmente, preencher checklist do PR
2. **PR aberto**: usar o template de PR, descrever o que foi feito
3. **Review**: ao menos 1 aprovação obrigatória para merge em `main`
4. **CI**: todos os jobs devem passar (lint, test, build)
5. **Merge**: somente após PR aprovado e CI verde

---

## O que NÃO é critério de pronto

Para evitar bloqueios desnecessários, os itens abaixo **não são critérios obrigatórios** para considerar uma entrega pronta:

- Cobertura de 100% do código (o mínimo é 60% nos módulos críticos)
- Testes E2E completos com browser (exceto quando explicitamente exigido pela story)
- Documentação de API no formato OpenAPI/Swagger (a menos que seja o objetivo da entrega)
- Performance otimizada (exceto se for requisito explícito)
- Revisão de mais de 1 pessoa (exceto em mudanças em módulos de billing ou autenticação)

---

## Referência rápida

| Critério | TASK | STORY | EPIC |
|----------|------|-------|------|
| Código funcionando localmente | ✅ | ✅ | ✅ |
| Sem debug/secrets | ✅ | ✅ | ✅ |
| Lint passando | ✅ | ✅ | ✅ |
| Build passando | ✅ | ✅ | ✅ |
| Testes unitários | ✅ | ✅ | ✅ |
| Testes de integração | ❌ | ✅ | ✅ |
| Tratamento de erro completo | Básico | ✅ | ✅ |
| Logs de auditoria | ❌ | ✅ (quando aplicável) | ✅ |
| Documentação de contrato | ❌ | ✅ (quando aplicável) | ✅ |
| Cobertura mínima no CI | ❌ | ❌ | ✅ |
| Critérios de aceite validados | ❌ | ❌ | ✅ |
| PR revisado | ❌ | ✅ | ✅ |

---

## Referências

- [CONTRIBUTING.md](../CONTRIBUTING.md) — fluxo de trabalho e branches
- [PR Template](.github/pull_request_template.md) — checklist de DoD para pull requests
- [Issue Templates](.github/ISSUE_TEMPLATE/) — templates por tipo de entrega
- [CI/CD](.github/workflows/ci.yml) — pipeline de qualidade automatizado
