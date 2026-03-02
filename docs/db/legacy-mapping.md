# Mapa de Relacionamentos — Schema Legado MySQL (`finlly_go.sql`)

> **Data:** 2026-03-02
> **Propósito:** Documentar dependências entre tabelas, cascatas de delete e entidades críticas.

---

## Grafo de FKs Críticas

```
usuarios (raiz)
├── assinantes (usuario_id) [1:N]
│   └── assinantes_pagamentos (assinante_id) [1:N]  ← CASCADE
├── contas (usuario_id) [1:N]  ← CASCADE
│   ├── contas_pagar (conta_id) [1:N]  ← SET NULL
│   ├── contas_receber (conta_id) [1:N]  ← SET NULL
│   ├── movimentacoes_caixa (conta_id) [1:N]  ← CASCADE
│   └── investimentos (conta_id) [1:N]  ← SET NULL
│       └── investimentos_eventos (investimento_id) [1:N]  ← CASCADE
├── categorias (usuario_id) [1:N]  ← CASCADE
│   ├── categorias (parent_id — self) [tree]  ← SET NULL / CASCADE
│   ├── contas_pagar (categoria_id) [1:N]  ← SET NULL
│   └── contas_receber (categoria_id) [1:N]  ← SET NULL
├── metas (usuario_id) [1:N]  ← CASCADE
│   └── metas_movimentos (meta_id) [1:N]  ← CASCADE
├── anexos (usuario_id) [1:N]  ← CASCADE
│   └── anexos_vinculos (anexo_id + entidade) [polimórfico 1:N]  ← CASCADE
└── whatsapp_logs (usuario_id) [1:N]  ← SET NULL

contas_pagar / contas_receber
└── movimentacoes_caixa (id_origem + origem) [polimórfico — sem FK real]

tipos_investimento ←── investimentos (tipo_investimento_id)
instituicoes_financeiras ←── investimentos (instituicao_id)
```

---

## Dependências Explícitas (FKs Declaradas no DDL)

| Tabela Filho              | Campo FK             | Tabela Pai               | Ação ao Deletar Pai |
|---------------------------|----------------------|--------------------------|---------------------|
| `assinantes`              | `usuario_id`         | `usuarios`               | —                   |
| `assinantes_pagamentos`   | `assinante_id`       | `assinantes`             | CASCADE             |
| `contas`                  | `usuario_id`         | `usuarios`               | CASCADE             |
| `categorias`              | `usuario_id`         | `usuarios`               | CASCADE             |
| `categorias`              | `parent_id`          | `categorias` (self)      | —                   |
| `contas_pagar`            | `usuario_id`         | `usuarios`               | CASCADE             |
| `contas_pagar`            | `conta_id`           | `contas`                 | SET NULL            |
| `contas_pagar`            | `categoria_id`       | `categorias`             | SET NULL            |
| `contas_receber`          | `usuario_id`         | `usuarios`               | CASCADE             |
| `contas_receber`          | `conta_id`           | `contas`                 | SET NULL            |
| `contas_receber`          | `categoria_id`       | `categorias`             | SET NULL            |
| `movimentacoes_caixa`     | `usuario_id`         | `usuarios`               | CASCADE             |
| `movimentacoes_caixa`     | `conta_id`           | `contas`                 | CASCADE             |
| `investimentos`           | `usuario_id`         | `usuarios`               | CASCADE             |
| `investimentos`           | `instituicao_id`     | `instituicoes_financeiras` | SET NULL          |
| `investimentos`           | `conta_id`           | `contas`                 | SET NULL            |
| `investimentos`           | `tipo_investimento_id` | `tipos_investimento`   | —                   |
| `investimentos_eventos`   | `investimento_id`    | `investimentos`          | CASCADE             |
| `metas`                   | `usuario_id`         | `usuarios`               | CASCADE             |
| `metas`                   | `conta_id`           | `contas`                 | SET NULL            |
| `metas_movimentos`        | `meta_id`            | `metas`                  | CASCADE             |
| `metas_movimentos`        | `usuario_id`         | `usuarios`               | CASCADE             |
| `anexos`                  | `usuario_id`         | `usuarios`               | CASCADE             |
| `anexos_vinculos`         | `anexo_id`           | `anexos`                 | CASCADE             |
| `anexos_vinculos`         | `usuario_id`         | `usuarios`               | CASCADE             |
| `whatsapp_logs`           | `usuario_id`         | `usuarios`               | SET NULL            |

---

## Relacionamentos Polimórficos (Sem FK Real)

| Tabela                | Campos Polimórficos             | Entidades Possíveis                                                          | Risco                                    |
|-----------------------|---------------------------------|------------------------------------------------------------------------------|------------------------------------------|
| `movimentacoes_caixa` | `origem` (string) + `id_origem` | `conta_pagar`, `conta_receber`, `ajuste`, `investimento`                     | Órfão silencioso se origem for deletada  |
| `anexos_vinculos`     | `entidade` (string) + `entidade_id` | `conta_pagar`, `conta_receber`, `investimento`, `investimento_evento`, `movimentacao_caixa` | Sem validação em nível de banco |

---

## Cascatas ON DELETE CASCADE

Ao deletar um **`usuario`**, são deletados em cascata:
- `contas` → e recursivamente `movimentacoes_caixa` (via `conta_id`)
- `categorias`
- `contas_pagar`
- `contas_receber`
- `investimentos` → e recursivamente `investimentos_eventos`
- `metas` → e recursivamente `metas_movimentos`
- `anexos` → e recursivamente `anexos_vinculos`

Ao deletar uma **`conta`**, são deletados em cascata:
- `movimentacoes_caixa`

Ao deletar um **`investimento`**:
- `investimentos_eventos` (CASCADE)

Ao deletar uma **`meta`**:
- `metas_movimentos` (CASCADE)

Ao deletar um **`anexo`**:
- `anexos_vinculos` (CASCADE)

Ao deletar um **`assinante`**:
- `assinantes_pagamentos` (CASCADE)

---

## Entidades Críticas (Alto Impacto de Deleção)

| Entidade    | Tabelas Afetadas por Deleção                                                   |
|-------------|--------------------------------------------------------------------------------|
| `usuarios`  | ~10 tabelas em cascata — entidade raiz do sistema                              |
| `contas`    | `movimentacoes_caixa` (CASCADE), `contas_pagar`, `contas_receber`, `investimentos` (SET NULL) |
| `categorias`| `contas_pagar`, `contas_receber` (SET NULL); auto-referência para subcategorias |
| `investimentos` | `investimentos_eventos` (CASCADE)                                          |

---

*Documento gerado em: 2026-03-02*
*Documentos relacionados: `01-legacy-schema-mapping.md` (inventário), `legacy-schema-mapping.md` (inconsistências)*