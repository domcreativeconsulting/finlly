import { z } from 'zod';

const IANA_TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza',
  'America/Recife', 'America/Maceio', 'America/Bahia', 'America/Cuiaba',
  'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco',
  'America/Noronha', 'America/Araguaina',
  'UTC', 'Europe/Lisbon', 'Europe/London', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Mexico_City', 'America/Argentina/Buenos_Aires',
  'America/Lima', 'America/Bogota', 'America/Santiago',
  'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland',
];

export const updatePerfilSchema = z
  .object({
    nome: z.string().trim().min(3).max(255).optional(),
    email: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
    whatsapp: z.string().trim().max(20).regex(/^\+?[\d\s\-().]+$/, 'Número inválido').optional().nullable(),
    timezone: z
      .string()
      .refine((tz) => IANA_TIMEZONES.includes(tz), {
        message: `Timezone inválida. Use um identificador IANA válido (ex: 'America/Sao_Paulo', 'UTC')`,
      })
      .optional(),
    moeda: z.string().length(3).transform((val) => val.toUpperCase()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });

export const changePasswordSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128)
    .regex(/[A-Z]/, 'Deve conter letra maiúscula')
    .regex(/[a-z]/, 'Deve conter letra minúscula')
    .regex(/[0-9]/, 'Deve conter número')
    .regex(/[!@#$%^&*]/, 'Deve conter caractere especial'),
});
