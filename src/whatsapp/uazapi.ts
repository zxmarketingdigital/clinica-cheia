/**
 * Lógica de envio exclusiva do provedor UAZAPI.
 * Importado por adapter.ts — não duplicar aqui e lá.
 */

export interface UazapiCfg {
  url: string;
  token: string;
}

export async function sendUazapi(
  cfg: UazapiCfg,
  telefone: string,
  texto: string,
  f: typeof fetch,
): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await f(`${cfg.url}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: cfg.token },
      body: JSON.stringify({ number: telefone, text: texto }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`uazapi send ${r.status}`);
  } finally {
    clearTimeout(t);
  }
}
