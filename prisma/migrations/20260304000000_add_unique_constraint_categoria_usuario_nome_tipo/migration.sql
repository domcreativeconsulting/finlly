-- AddUniqueConstraint
ALTER TABLE "categorias"
ADD CONSTRAINT "uq_categoria_usuario_nome_tipo" UNIQUE ("usuario_id", "nome", "tipo");
