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
