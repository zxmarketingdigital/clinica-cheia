import { sendUazapi } from "./uazapi.js";

type Provider = "uazapi" | "zapi" | "meta";

export interface InboundMsg {
  telefone: string;
  texto: string;
}

export interface WhatsAppAdapter {
  send(telefone: string, texto: string): Promise<void>;
}

export function normalizeInbound(provider: Provider, body: unknown): InboundMsg | null {
  if (provider === "uazapi") {
    const m = (body as any)?.message;
    if (!m || m.fromMe) return null;
    if (!m.sender || !m.text) return null;
    return { telefone: String(m.sender), texto: String(m.text) };
  }
  // zapi/meta normalizados em tasks-irmãs
  return null;
}

export function makeAdapter(cfg: any, f: typeof fetch = fetch): WhatsAppAdapter {
  if (cfg.provider === "uazapi") {
    return {
      async send(telefone: string, texto: string): Promise<void> {
        await sendUazapi({ url: cfg.url, token: cfg.token }, telefone, texto, f);
      },
    };
  }
  throw new Error(`provider não implementado nesta task: ${cfg.provider}`);
}
