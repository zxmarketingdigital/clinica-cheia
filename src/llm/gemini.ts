export async function geminiChat(
  p: { key: string; system: string; user: string; model?: string },
  f: typeof fetch = fetch
): Promise<string> {
  const model = p.model ?? "gemini-2.5-flash";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await f(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${p.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: p.system }] },
          contents: [{ role: "user", parts: [{ text: p.user }] }],
          // temperature:0 → extração de [[AGENDAR ... inicio=ISO]] determinística.
          // Mesmo input gera o mesmo horário, então o índice único (cliente_id,inicio)
          // deduplica reenvios/bursts em vez de criar agendamentos divergentes.
          generationConfig: { temperature: 0 },
        }),
        signal: ctrl.signal,
      }
    );
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j: any = await r.json();
    return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } finally {
    clearTimeout(t);
  }
}
