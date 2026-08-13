import { describe, it, expect, vi } from "vitest";
import { geminiChat } from "../src/llm/gemini";

it("monta request e extrai texto da resposta", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "resposta" }] } }],
      }),
      { status: 200 }
    )
  );
  const out = await geminiChat({ key: "K", system: "sys", user: "oi" }, f);
  expect(out).toBe("resposta");
  expect(String(f.mock.calls[0][0])).toContain(
    "models/gemini-flash-lite-latest:generateContent"
  );
});

it("extrai texto de parts posteriores ao thoughtSignature", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ thoughtSignature: "sig" }, { text: "resposta posterior" }] } }],
      }),
      { status: 200 }
    )
  );
  const out = await geminiChat({ key: "K", system: "sys", user: "oi" }, f);
  expect(out).toBe("resposta posterior");
});

it("retorna string vazia quando nenhum part tem text", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ thoughtSignature: "sig" }] } }],
      }),
      { status: 200 }
    )
  );
  const out = await geminiChat({ key: "K", system: "sys", user: "oi" }, f);
  expect(out).toBe("");
});

it("usa o modelo informado na URL", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
      { status: 200 }
    )
  );
  await geminiChat({ key: "K", system: "sys", user: "oi", model: "modelo-teste" }, f);
  expect(String(f.mock.calls[0][0])).toContain(
    "models/modelo-teste:generateContent"
  );
});

// GEMINI_MODEL="" no .env é o caso realista: sem o fallback a URL sairia sem modelo e
// TODA conversa quebraria, enquanto o smoke (que usa ||) continuaria passando.
it.each(["", "   "])("cai no default quando GEMINI_MODEL é %j", async (vazio) => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
      { status: 200 }
    )
  );
  await geminiChat({ key: "K", system: "sys", user: "oi", model: vazio }, f);
  expect(String(f.mock.calls[0][0])).toContain(
    "models/gemini-flash-lite-latest:generateContent"
  );
});

it("não vaza raciocínio interno (part com thought:true) para o cliente", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "o paciente quer 15h, checar agenda interna" },
                { text: "Claro! Agendei para amanhã às 15h." },
              ],
            },
          },
        ],
      }),
      { status: 200 }
    )
  );
  const out = await geminiChat({ key: "K", system: "sys", user: "oi" }, f);
  expect(out).toBe("Claro! Agendei para amanhã às 15h.");
  expect(out).not.toContain("agenda interna");
});
