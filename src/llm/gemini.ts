export async function geminiChat(
  p: { key: string; system: string; user: string; model?: string },
  f: typeof fetch = fetch
): Promise<string> {
  const model = p.model ?? "gemini-2.0-flash";
  const r = await f(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${p.key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.system }] },
        contents: [{ role: "user", parts: [{ text: p.user }] }],
      }),
    }
  );
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j: any = await r.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
