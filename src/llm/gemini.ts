export async function geminiChat(
  p: { key: string; system: string; user: string; model?: string },
  f: typeof fetch = fetch
): Promise<string> {
  // Alias "latest" do lite: baixa latência dentro do timeout e sem thinking; gemini-2.5-flash foi aposentado.
  // `|| ` (e não `??`): GEMINI_MODEL vazio/em branco no .env tem que cair no default, senão a URL
  // sai sem modelo e TODA conversa falha — enquanto o smoke, que usa `||`, passaria (falso positivo).
  const model = p.model?.trim() || "gemini-flash-lite-latest";
  const ctrl = new AbortController();
  // Teto de segurança caso o alias resolva para um modelo de raciocínio mais lento.
  const t = setTimeout(() => ctrl.abort(), 20000);
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
    // Junta TODOS os parts de resposta, não só o [0]: em modelo de raciocínio o primeiro part
    // pode vir só com thoughtSignature (sem text) e o parser antigo devolvia "" em silêncio.
    // `thought === true` é o raciocínio interno — fica de fora, senão vazaria pro WhatsApp do paciente.
    const parts = j?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts)
      ? parts
          .filter(
            (part: any) =>
              part?.thought !== true && typeof part?.text === "string" && part.text !== ""
          )
          .map((part: any) => part.text)
          .join("")
      : "";
  } finally {
    clearTimeout(t);
  }
}
