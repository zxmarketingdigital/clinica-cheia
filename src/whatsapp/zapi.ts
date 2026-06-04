/**
 * Lógica de envio exclusiva do provedor Z-API.
 * Importado por adapter.ts — não duplicar aqui e lá.
 * Endpoint: https://api.z-api.io/instances/{instance}/token/{token}/send-text
 * Auth: header Client-Token. Body: { phone, message }.
 */

export interface ZapiCfg {
  instance: string;
  token: string;
  clientToken: string;
}

export async function sendZapi(
  cfg: ZapiCfg,
  telefone: string,
  texto: string,
  f: typeof fetch,
): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await f(
      `https://api.z-api.io/instances/${cfg.instance}/token/${cfg.token}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": cfg.clientToken },
        body: JSON.stringify({ phone: telefone, message: texto }),
        signal: ctrl.signal,
      },
    );
    if (!r.ok) throw new Error(`zapi send ${r.status}`);
  } finally {
    clearTimeout(t);
  }
}
