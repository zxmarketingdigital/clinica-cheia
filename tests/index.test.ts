import { it, expect } from "vitest";
import worker, { agentesParaHora } from "../src/index";

it("/health responde 200", async () => {
  const res = await worker.fetch(new Request("https://x/health"), {} as any, {} as any);
  expect(res.status).toBe(200);
});
it("rota desconhecida responde 404", async () => {
  const res = await worker.fetch(new Request("https://x/nope"), {} as any, {} as any);
  expect(res.status).toBe(404);
});
it("agentesParaHora mapeia as horas certas", () => {
  expect(agentesParaHora(18)).toContain("confirmador");
  expect(agentesParaHora(11)).toContain("resgate");
  expect(agentesParaHora(10)).toContain("lembrete-retorno");
  expect(agentesParaHora(9)).toContain("reativador");
  expect(agentesParaHora(3)).toEqual([]);
});
it("POST /webhook com token errado retorna 401", async () => {
  const req = new Request("https://x/webhook?token=errado", { method: "POST", body: "{}" });
  const res = await worker.fetch(req, { WEBHOOK_SECRET: "s" } as any, {} as any);
  expect(res.status).toBe(401);
});
it("POST /webhook sem token nenhum retorna 401 (fail-closed)", async () => {
  const req = new Request("https://x/webhook", { method: "POST", body: "{}" });
  const res = await worker.fetch(req, { WEBHOOK_SECRET: "s" } as any, {} as any);
  expect(res.status).toBe(401);
});
it("POST /webhook com header X-Webhook-Secret errado retorna 401", async () => {
  const req = new Request("https://x/webhook", { method: "POST", body: "{}", headers: { "X-Webhook-Secret": "errado" } });
  const res = await worker.fetch(req, { WEBHOOK_SECRET: "s" } as any, {} as any);
  expect(res.status).toBe(401);
});
