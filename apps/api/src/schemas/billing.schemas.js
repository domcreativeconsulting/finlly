import { z } from 'zod';

const creditCardSchema = z.object({
  holderName:  z.string().min(1),
  number:      z.string().regex(/^\d{13,19}$/, 'Número do cartão inválido'),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, 'Mês inválido'),
  expiryYear:  z.string().regex(/^\d{4}$/, 'Ano inválido'),
  ccv:         z.string().regex(/^\d{3,4}$/, 'CVV inválido'),
});

const creditCardHolderInfoSchema = z.object({
  name:          z.string().min(1),
  email:         z.string().email(),
  cpfCnpj:       z.string().min(11),
  postalCode:    z.string().optional(),
  addressNumber: z.string().optional(),
  phone:         z.string().optional(),
});

export const subscribeSchema = z.object({
  plano:                z.enum(['mensal', 'anual']),
  ciclo:                z.enum(['mensal', 'anual']),
  formaPagamento:       z.enum(['PIX', 'CREDIT_CARD']),
  cupomCodigo:          z.string().optional(),
  nome:                 z.string().min(1).optional(),
  email:                z.string().email().optional(),
  cpf:                  z.string().optional(),
  telefone:             z.string().optional(),
  creditCard:           creditCardSchema.optional(),
  creditCardHolderInfo: creditCardHolderInfoSchema.optional(),
  remoteIp:             z.string().optional(),
}).refine(
  (data) => {
    if (data.formaPagamento === 'CREDIT_CARD') {
      return !!data.creditCard && !!data.creditCardHolderInfo;
    }
    return true;
  },
  { message: 'Dados do cartão obrigatórios para pagamento com cartão', path: ['creditCard'] }
);
