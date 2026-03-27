-- DropForeignKey
ALTER TABLE "anexos" DROP CONSTRAINT "fk_anexos_usuario";

-- DropForeignKey
ALTER TABLE "anexos_vinculos" DROP CONSTRAINT "fk_avinculos_anexo";

-- DropForeignKey
ALTER TABLE "assinantes" DROP CONSTRAINT "fk_assinantes_cupom";

-- DropForeignKey
ALTER TABLE "assinantes" DROP CONSTRAINT "fk_assinantes_usuario";

-- DropForeignKey
ALTER TABLE "assinantes_pagamentos" DROP CONSTRAINT "fk_apagamentos_assinante";

-- DropForeignKey
ALTER TABLE "assinantes_pagamentos" DROP CONSTRAINT "fk_apagamentos_usuario";

-- DropForeignKey
ALTER TABLE "categorias" DROP CONSTRAINT "fk_categorias_pai";

-- DropForeignKey
ALTER TABLE "categorias" DROP CONSTRAINT "fk_categorias_usuario";

-- DropForeignKey
ALTER TABLE "contas" DROP CONSTRAINT "fk_contas_instituicao";

-- DropForeignKey
ALTER TABLE "contas" DROP CONSTRAINT "fk_contas_usuario";

-- DropForeignKey
ALTER TABLE "contas_pagar" DROP CONSTRAINT "fk_cpagar_categoria";

-- DropForeignKey
ALTER TABLE "contas_pagar" DROP CONSTRAINT "fk_cpagar_conta";

-- DropForeignKey
ALTER TABLE "contas_pagar" DROP CONSTRAINT "fk_cpagar_usuario";

-- DropForeignKey
ALTER TABLE "contas_receber" DROP CONSTRAINT "fk_creceber_categoria";

-- DropForeignKey
ALTER TABLE "contas_receber" DROP CONSTRAINT "fk_creceber_conta";

-- DropForeignKey
ALTER TABLE "contas_receber" DROP CONSTRAINT "fk_creceber_usuario";

-- DropForeignKey
ALTER TABLE "investimentos" DROP CONSTRAINT "fk_invest_instituicao";

-- DropForeignKey
ALTER TABLE "investimentos" DROP CONSTRAINT "fk_invest_tipo";

-- DropForeignKey
ALTER TABLE "investimentos" DROP CONSTRAINT "fk_invest_usuario";

-- DropForeignKey
ALTER TABLE "investimentos_eventos" DROP CONSTRAINT "fk_inv_evento_investimento";

-- DropForeignKey
ALTER TABLE "investimentos_eventos" DROP CONSTRAINT "fk_inv_evento_usuario";

-- DropForeignKey
ALTER TABLE "metas" DROP CONSTRAINT "fk_metas_usuario";

-- DropForeignKey
ALTER TABLE "metas_movimentos" DROP CONSTRAINT "fk_mm_meta";

-- DropForeignKey
ALTER TABLE "metas_movimentos" DROP CONSTRAINT "fk_mm_movimentacao";

-- DropForeignKey
ALTER TABLE "metas_movimentos" DROP CONSTRAINT "fk_mm_usuario";

-- DropForeignKey
ALTER TABLE "movimentacoes_caixa" DROP CONSTRAINT "fk_movim_categoria";

-- DropForeignKey
ALTER TABLE "movimentacoes_caixa" DROP CONSTRAINT "fk_movim_conta";

-- DropForeignKey
ALTER TABLE "movimentacoes_caixa" DROP CONSTRAINT "fk_movim_conta_destino";

-- DropForeignKey
ALTER TABLE "movimentacoes_caixa" DROP CONSTRAINT "fk_movim_conta_pagar";

-- DropForeignKey
ALTER TABLE "movimentacoes_caixa" DROP CONSTRAINT "fk_movim_conta_receber";

-- DropForeignKey
ALTER TABLE "movimentacoes_caixa" DROP CONSTRAINT "fk_movim_usuario";

-- DropForeignKey
ALTER TABLE "usuario_eventos_auth" DROP CONSTRAINT "fk_eventos_auth_usuario";

-- DropForeignKey
ALTER TABLE "usuario_resets_senha" DROP CONSTRAINT "fk_resets_senha_usuario";

-- DropForeignKey
ALTER TABLE "usuario_sessoes" DROP CONSTRAINT "fk_sessoes_usuario";

-- DropForeignKey
ALTER TABLE "usuario_verificacoes_email" DROP CONSTRAINT "fk_verificacoes_email_usuario";

-- DropForeignKey
ALTER TABLE "whatsapp_logs" DROP CONSTRAINT "fk_wa_usuario";

-- AddForeignKey
ALTER TABLE "usuario_sessoes" ADD CONSTRAINT "fk_sessoes_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_eventos_auth" ADD CONSTRAINT "fk_eventos_auth_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_resets_senha" ADD CONSTRAINT "fk_resets_senha_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_verificacoes_email" ADD CONSTRAINT "fk_verificacoes_email_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinantes" ADD CONSTRAINT "fk_assinantes_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinantes" ADD CONSTRAINT "fk_assinantes_cupom" FOREIGN KEY ("cupom_id") REFERENCES "cupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinantes_pagamentos" ADD CONSTRAINT "fk_apagamentos_assinante" FOREIGN KEY ("assinante_id") REFERENCES "assinantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinantes_pagamentos" ADD CONSTRAINT "fk_apagamentos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas" ADD CONSTRAINT "fk_contas_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas" ADD CONSTRAINT "fk_contas_instituicao" FOREIGN KEY ("instituicao_financeira_id") REFERENCES "instituicoes_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "fk_categorias_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "fk_categorias_pai" FOREIGN KEY ("pai_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "fk_cpagar_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "fk_cpagar_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "fk_cpagar_conta" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_receber" ADD CONSTRAINT "fk_creceber_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_receber" ADD CONSTRAINT "fk_creceber_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_receber" ADD CONSTRAINT "fk_creceber_conta" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "fk_movim_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "fk_movim_conta" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "fk_movim_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "fk_movim_conta_destino" FOREIGN KEY ("conta_destino_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "fk_movim_conta_pagar" FOREIGN KEY ("conta_pagar_id") REFERENCES "contas_pagar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "fk_movim_conta_receber" FOREIGN KEY ("conta_receber_id") REFERENCES "contas_receber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investimentos" ADD CONSTRAINT "fk_invest_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investimentos" ADD CONSTRAINT "fk_invest_tipo" FOREIGN KEY ("tipo_id") REFERENCES "tipos_investimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investimentos" ADD CONSTRAINT "fk_invest_instituicao" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investimentos_eventos" ADD CONSTRAINT "fk_inv_evento_investimento" FOREIGN KEY ("investimento_id") REFERENCES "investimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investimentos_eventos" ADD CONSTRAINT "fk_inv_evento_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas" ADD CONSTRAINT "fk_metas_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_movimentos" ADD CONSTRAINT "fk_mm_meta" FOREIGN KEY ("meta_id") REFERENCES "metas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_movimentos" ADD CONSTRAINT "fk_mm_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_movimentos" ADD CONSTRAINT "fk_mm_movimentacao" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacoes_caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "fk_anexos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_vinculos" ADD CONSTRAINT "fk_avinculos_anexo" FOREIGN KEY ("anexo_id") REFERENCES "anexos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "fk_wa_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
