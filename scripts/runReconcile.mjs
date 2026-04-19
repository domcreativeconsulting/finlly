#!/usr/bin/env node
// scripts/runReconcile.mjs
import('../apps/api/src/services/reconciliacaoService.js')
  .then(mod => mod.reconciliarAssinaturas())
  .then(res => {
    console.log('Reconciliação finalizada:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('Erro na reconciliacao:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
