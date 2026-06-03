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
    "generativelanguage.googleapis.com"
  );
});
