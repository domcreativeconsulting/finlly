import { z } from 'zod';

export const whatsappWebhookSchema = z.object({
  event: z.string().min(1),
  instance: z.string().optional(),
  data: z.object({
    key: z.object({
      remoteJid: z.string().min(1),
      fromMe: z.boolean().optional(),
      id: z.string().optional(),
    }),
    messageTimestamp: z.number().optional(),
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z
          .object({
            text: z.string().optional(),
          })
          .optional(),
        imageMessage: z.object({}).passthrough().optional(),
        audioMessage: z.object({}).passthrough().optional(),
        documentMessage: z.object({}).passthrough().optional(),
        stickerMessage: z.object({}).passthrough().optional(),
      })
      .passthrough()
      .optional(),
    pushName: z.string().optional(),
  }),
});
