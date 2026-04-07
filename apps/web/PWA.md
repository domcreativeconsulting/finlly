# PWA — Como testar a instalação

## Sobre o PWA do Finlly

O Finlly é configurado como PWA (Progressive Web App) usando [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) com [Workbox](https://developer.chrome.com/docs/workbox/). Isso permite instalação na tela inicial, abertura em modo standalone e cache offline de conteúdo essencial.

---

## Requisitos para instalação

O PWA **só pode ser instalado e operar completamente** em:

- **HTTPS** — obrigatório para service workers em produção
- **Build de produção** (`pnpm run build`) — o service worker é gerado apenas no build
- Navegadores compatíveis: Chrome/Edge (desktop e Android), Safari (iOS 16.4+), Firefox parcialmente

> ⚠️ Em `http://localhost` (dev), o browser pode bloquear o service worker. Use as instruções abaixo para testar.

---

## Testando em desenvolvimento (modo dev)

O `vite.config.js` tem `devOptions.enabled: true`, o que ativa o service worker em ambiente de desenvolvimento.

### Passos

1. Inicie o servidor de desenvolvimento:
   ```bash
   cd apps/web
   pnpm run dev
   ```

2. Acesse `http://localhost:5173` no Chrome.

3. Abra **DevTools → Application → Service Workers** e confirme que o SW está registrado.

4. Abra **DevTools → Application → Manifest** para validar os campos do manifest.

> **Nota:** Em dev com `type: 'module'`, o service worker usa o modo ES module. Se encontrar erros, verifique o console do DevTools.

---

## Testando em build de produção

Para uma validação completa (recomendada antes de deploy):

```bash
cd apps/web
pnpm run build
pnpm run preview
```

Acesse `http://localhost:4173` — o preview serve os assets de produção com service worker completo.

---

## Checklist de validação manual

### Chrome DevTools → Application → Manifest
- [ ] `name`: "Finlly"
- [ ] `short_name`: "Finlly"
- [ ] `start_url`: "/"
- [ ] `display`: "standalone"
- [ ] `theme_color`: "#33528a"
- [ ] `background_color`: "#f3f4f6"
- [ ] Ícone aparece na prévia

### Chrome DevTools → Application → Service Workers
- [ ] Status: "activated and is running"
- [ ] Source: `sw.js`
- [ ] Nenhum erro no console

### Chrome DevTools → Application → Cache Storage
- [ ] `workbox-precache-*` contém assets JS, CSS, HTML
- [ ] `finlly-google-fonts-*` após acessar a app
- [ ] `finlly-api-readonly` após navegar pelas páginas

### Lighthouse (DevTools → Lighthouse → Progressive Web App)
- [ ] Pontuação PWA: verde (sem erros críticos)
- [ ] "Installable" sem alertas

### Instalação
- [ ] Ícone de instalação aparece na barra de endereço (Chrome desktop)
- [ ] No Android: banner "Adicionar à tela inicial"
- [ ] Após instalação: abre sem barra do browser (modo standalone)

---

## Habilitar instalação em origem insegura (localhost/HTTP)

Para forçar o browser a tratar `localhost` como seguro (necessário em alguns casos):

1. Abra `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Adicione `http://localhost:5173` na lista
3. Reinicie o Chrome

---

## Estratégia de cache

| Tipo de recurso | Estratégia | Cache name | TTL |
|---|---|---|---|
| App shell (JS/CSS/HTML) | Precache (CacheFirst) | `workbox-precache-*` | Até próximo deploy |
| Google Fonts (CSS) | CacheFirst | `finlly-google-fonts-stylesheets` | 1 ano |
| Google Fonts (fontes) | CacheFirst | `finlly-google-fonts-webfonts` | 1 ano |
| API read-only | NetworkFirst | `finlly-api-readonly` | 24 horas |

---

## Observações

- **Ícones**: O projeto usa `finlly.png` com `sizes: 'any'` — válido pela spec W3C Web App Manifest. Ícones em múltiplos tamanhos reais podem ser adicionados futuramente.
- **Cache de dados autenticados**: Rotas de API retornam 401/403 em sessão expirada. O `cacheableResponse: { statuses: [200] }` na rota de API garante que apenas respostas bem-sucedidas são cacheadas — nunca tokens de erro.
- **Limpeza de cache**: `cleanupLegacyCaches()` é chamado no boot da app. No logout, `clearUserOfflineCache(userId)` limpa dados do usuário.
