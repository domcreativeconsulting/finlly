## Descrição

<!-- Descreva o que foi implementado, alterado ou corrigido. -->

## Tipo de mudança

- [ ] 🐛 Bug fix
- [ ] ✨ Nova feature
- [ ] ♻️ Refactoring
- [ ] 📝 Documentação
- [ ] 🧪 Testes
- [ ] 🔧 Configuração / infra

## Checklist — Definition of Done

### Código
- [ ] Código implementado e funcionando localmente
- [ ] Sem `console.log` ou código de debug deixado para trás
- [ ] Sem segredos ou credenciais hardcoded
- [ ] Linting passando (`npm run lint`)
- [ ] Build passando (`npm run build`)

### Validação
- [ ] Input validado com Zod (quando aplicável)
- [ ] Erros tratados com `AppError` e status HTTP correto
- [ ] Edge cases identificados e tratados

### Testes
- [ ] Testes automatizados escritos para a funcionalidade
- [ ] Todos os testes existentes passando (`npm run test`)
- [ ] Fluxos críticos (billing, webhook, WhatsApp) com cobertura mínima

### Segurança e qualidade
- [ ] Middleware de autenticação/autorização aplicado nas rotas (quando aplicável)
- [ ] Logs de auditoria registrados para operações sensíveis (quando aplicável)
- [ ] Dados sensíveis não expostos em logs ou respostas

### Documentação
- [ ] Contrato da rota ou comportamento documentado (se novo endpoint ou mudança de API)
- [ ] README ou docs atualizados (se necessário)

## Fluxos críticos impactados

<!-- Marque se esta PR afeta algum dos fluxos abaixo -->

- [ ] 💳 Billing / Assinaturas (Asaas)
- [ ] 🔔 Webhooks (Asaas / Evolution)
- [ ] 📱 WhatsApp Agent
- [ ] 🔐 Autenticação / Autorização
- [ ] 📊 Movimentações financeiras
- [ ] 🗄️ Banco de dados (migrations)

## Testes realizados

<!-- Descreva como você testou as mudanças -->

## Screenshots (se aplicável)

<!-- Adicione screenshots para mudanças visuais -->
