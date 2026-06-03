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
  const r = await f(`${cfg.url}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: cfg.token },
    body: JSON.stringify({ number: telefone, text: texto }),
  });
  if (!r.ok) throw new Error(`uazapi send ${r.status}`);
}
