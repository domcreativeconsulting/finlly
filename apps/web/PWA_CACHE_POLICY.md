# PWA Cache Policy — Finlly

## O que é cacheado

### App Shell (Workbox — precache)
Todos os assets estáticos gerados pelo Vite são pré-cacheados pelo Workbox via `VitePWA`:
- HTML (`index.html`)
- JavaScript bundles (`.js`)
- CSS (`.css`)
- Fontes Inter (`.woff`, `.woff2`)
- Ícones e imagens (`.png`, `.svg`, `.ico`, `.webp`)

### Google Fonts
- Stylesheets: cacheados com estratégia `CacheFirst`, máximo 1 entrada
- Webfonts: cacheados com estratégia `CacheFirst`, máximo 30 entradas

### APIs de leitura (Workbox — runtime)
Rotas que correspondem a `/api/` com respostas HTTP 200 são cacheadas com estratégia `NetworkFirst`:
- Cache name: `finlly-api-readonly`
- Máximo 50 entradas, expiração em 24 horas
- Apenas respostas com status 200 são armazenadas

### Dados de páginas (localStorage — `useOfflineCache`)
Cada página que suporta leitura offline salva seus dados no `localStorage` via o hook `useOfflineCache`:

| Página | Chave de cache | Descrição |
|---|---|---|
| DashboardPage | `dashboard` | Resumo financeiro do período |
| ExtratoPage | `extrato` | Lista de movimentações |
| ContasPagarPage | `contas-pagar` | Lista de contas a pagar |
| ContasReceberPage | `contas-receber` | Lista de contas a receber |
| ContasPage | `contas` | Lista de carteiras/contas bancárias |

---

## Estratégia por tipo de recurso

| Tipo | Estratégia | Camada |
|---|---|---|
| App shell (HTML/JS/CSS/fonts) | `CacheFirst` (precache) | Workbox / Service Worker |
| Google Fonts stylesheets | `CacheFirst` | Workbox / Service Worker |
| Google Fonts webfonts | `CacheFirst` | Workbox / Service Worker |
| APIs de leitura (`/api/`) | `NetworkFirst` | Workbox / Service Worker |
| Dados de páginas (lista, resumo) | `localStorage` com TTL | `useOfflineCache` hook |

---

## TTL por camada

| Camada | TTL |
|---|---|
| Workbox precache (app shell) | Indefinido — invalidado apenas em novo deploy (hash muda) |
| Google Fonts | Indefinido — `CacheFirst` sem expiração configurada |
| API readonly (Workbox) | 24 horas (`maxAgeSeconds: 86400`) |
| localStorage (`useOfflineCache`) | 24 horas (`CACHE_TTL_MS = 24 * 60 * 60 * 1000`) |

---

## Telas com fallback offline

As seguintes telas possuem suporte a leitura offline com exibição de dados cacheados:

- **DashboardPage** — exibe resumo financeiro do cache
- **ExtratoPage** — exibe lista de movimentações do cache
- **ContasPagarPage** — exibe lista de contas a pagar do cache
- **ContasReceberPage** — exibe lista de contas a receber do cache
- **ContasPage** — exibe lista de carteiras do cache

Quando o usuário está offline e há dados cacheados, um badge `OfflineDataBadge` é exibido com o timestamp do último cache.

Quando o usuário está offline e **não há dados cacheados**, o componente `OfflineFallback` é exibido informando que o conteúdo não está disponível offline.

---

## O que está fora do escopo

As seguintes funcionalidades **não** estão implementadas e estão fora do escopo desta versão:

- **Escrita offline**: criação, edição e exclusão de registros requerem conexão ativa
- **Background Sync**: não há sincronização automática de dados pendentes ao reconectar
- **Push Notifications**: não há suporte a notificações push
- **Resolução de conflitos**: não há lógica de merge de dados locais vs. remotos
- **Cache de anexos**: comprovantes e arquivos não são cacheados offline

Todos os botões de escrita são desabilitados quando o usuário está offline (`disabled={!isOnline}`).

---

## Como evoluir

### Adicionar nova página com suporte offline

1. Importar `useOfflineCache`, `useOnlineStatus`, `useRequireOnline`, `OfflineDataBadge`, `OfflineFallback`
2. Inicializar o hook: `const { saveCache, readCache } = useOfflineCache(usuario?.id)`
3. Adicionar `saveCache('chave', data)` após carregar os dados
4. Adicionar fallback no `catch`: `const cached = readCache('chave'); if (cached) { ... }`
5. Renderizar `<OfflineDataBadge savedAt={cacheInfo} />` quando offline com cache
6. Renderizar `<OfflineFallback />` quando offline sem cache
7. Proteger botões de escrita: `disabled={!isOnline} title={!isOnline ? 'Disponível apenas online' : undefined}`

### Invalidar todos os caches após deploy breaking

Para invalidar todos os caches de dados de usuário após um deploy breaking (ex.: mudança no schema da API), incremente `CACHE_VERSION` em `apps/web/src/utils/offlineCacheManager.js`:

```js
// apps/web/src/utils/offlineCacheManager.js
export const CACHE_VERSION = 'v2'; // era 'v1'
```

Isso fará com que `cleanupLegacyCaches()` (chamado no boot da app) limpe todos os dados do localStorage com o prefixo `finlly_offline_` na próxima vez que o usuário abrir a aplicação.

Para o cache do Service Worker (assets e API), o Workbox lida automaticamente com a invalidação via `cleanupOutdatedCaches: true` configurado no `vite.config.js`.

### Adicionar nova rota de API ao cache do Service Worker

Em `vite.config.js`, dentro de `workbox.runtimeCaching`, adicione uma nova entrada:

```js
{
  urlPattern: /^https:\/\/sua-api\.com\/api\/nova-rota/,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'finlly-api-readonly',
    expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
    cacheableResponse: { statuses: [200] },
  },
},
```
