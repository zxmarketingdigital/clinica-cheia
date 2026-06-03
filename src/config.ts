// NOTE (zod v4.4.3): z.string().url() está marcado como @deprecated no v4
// em favor de z.url() (standalone format schema). Mantemos z.string().url()
// pois retorna ZodString (permite .min() encadeado) e ainda é funcional.
// Migrar para z.url() quando a API v4 estabilizar.

import { z } from "zod";

const base = z.object({
  CLINICA_NOME: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GOOGLE_REVIEW_LINK: z.string().url(),
  WEBHOOK_SECRET: z.string().optional(),
});

const wa = z.discriminatedUnion("WHATSAPP_PROVIDER", [
  z.object({
    WHATSAPP_PROVIDER: z.literal("uazapi"),
    UAZAPI_URL: z.string().url(),
    UAZAPI_TOKEN: z.string(),
  }),
  z.object({
    WHATSAPP_PROVIDER: z.literal("zapi"),
    ZAPI_INSTANCE: z.string(),
    ZAPI_TOKEN: z.string(),
    ZAPI_CLIENT_TOKEN: z.string(),
  }),
  z.object({
    WHATSAPP_PROVIDER: z.literal("meta"),
    META_PHONE_ID: z.string(),
    META_TOKEN: z.string(),
  }),
]);

export function parseConfig(env: Record<string, string>) {
  const b = base.parse(env);
  const w = wa.parse(env);

  return {
    clinicaNome: b.CLINICA_NOME,
    supabase: { url: b.SUPABASE_URL, key: b.SUPABASE_SERVICE_KEY },
    gemini: { key: b.GEMINI_API_KEY },
    googleReviewLink: b.GOOGLE_REVIEW_LINK,
    webhookSecret: b.WEBHOOK_SECRET,
    whatsapp:
      w.WHATSAPP_PROVIDER === "uazapi"
        ? { provider: "uazapi" as const, url: w.UAZAPI_URL, token: w.UAZAPI_TOKEN }
        : w.WHATSAPP_PROVIDER === "zapi"
        ? { provider: "zapi" as const, instance: w.ZAPI_INSTANCE, token: w.ZAPI_TOKEN, clientToken: w.ZAPI_CLIENT_TOKEN }
        : { provider: "meta" as const, phoneId: w.META_PHONE_ID, token: w.META_TOKEN },
  };
}

export type ClinicaConfig = ReturnType<typeof parseConfig>;
