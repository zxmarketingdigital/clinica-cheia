import { sendUazapi } from "./uazapi.js";
import { sendZapi } from "./zapi.js";

type Provider = "uazapi" | "zapi" | "meta";

export interface InboundMsg {
  telefone: string;
  texto: string;
  msgId?: string;
}

export interface WhatsAppAdapter {
  send(telefone: string, texto: string): Promise<void>;
}

export function normalizeInbound(provider: Provider, body: unknown): InboundMsg | null {
  if (provider === "uazapi") {
    const m = (body as any)?.message;
    if (!m || m.fromMe) return null;
    if (!m.sender || !m.text) return null;
    return { telefone: String(m.sender), texto: String(m.text), msgId: m.id ? String(m.id) : undefined };
  }
  if (provider === "zapi") {
    const b = body as any;
    if (!b || b.fromMe || b.isGroup) return null;
    let texto = b.text;
    if (texto && typeof texto === "object") texto = texto.message;
    if (!b.phone || typeof texto !== "string" || !texto) return null;
    return { telefone: String(b.phone), texto: String(texto), msgId: b.messageId ? String(b.messageId) : undefined };
  }
  // meta normalizado em task-irmã
  return null;
}

/**
 * Gating opcional por palavra-chave (ex: "/clinica"). Permite rodar este produto
 * numa instância de WhatsApp COMPARTILHADA: só as mensagens que começam com a
 * keyword são processadas (e a keyword é removida antes de ir ao agente); as
 * demais são ignoradas (null), deixadas para o outro handler daquele número.
 * Sem keyword configurada, a mensagem passa intacta (instância dedicada).
 */
export function applyKeywordGate(msg: InboundMsg | null, keyword?: string): InboundMsg | null {
  if (!msg) return null;
  if (!keyword) return msg;
  const kw = keyword.toLowerCase();
  const t = msg.texto.replace(/^\s+/, "");
  // prefixo precisa casar E ser seguido de espaço ou fim — evita que "/clinica"
  // case com "/clinicaxyz" (que mandaria "xyz" mutilado pro agente).
  if (t.toLowerCase().slice(0, kw.length) !== kw) return null;
  const rest = t.slice(keyword.length);
  if (rest.length > 0 && !/^\s/.test(rest)) return null;
  return { ...msg, texto: rest.replace(/^\s+/, "") };
}

export function makeAdapter(cfg: any, f: typeof fetch = fetch): WhatsAppAdapter {
  if (cfg.provider === "uazapi") {
    return {
      async send(telefone: string, texto: string): Promise<void> {
        await sendUazapi({ url: cfg.url, token: cfg.token }, telefone, texto, f);
      },
    };
  }
  if (cfg.provider === "zapi") {
    return {
      async send(telefone: string, texto: string): Promise<void> {
        await sendZapi(
          { instance: cfg.instance, token: cfg.token, clientToken: cfg.clientToken },
          telefone,
          texto,
          f,
        );
      },
    };
  }
  throw new Error(`provider não implementado nesta task: ${cfg.provider}`);
}
