import { describe, it, expect, vi } from "vitest";
import { Agenda } from "../src/db/agenda";

function fakeClient(rows: any[]) {
  const api: any = {};
  api.from = vi.fn().mockReturnValue(api);
  api.select = vi.fn().mockReturnValue(api);
  api.eq = vi.fn().mockReturnValue(api);
  api.gte = vi.fn().mockReturnValue(api);
  api.lte = vi.fn().mockReturnValue(api);
  api.then = (res: any) => res({ data: rows, error: null });
  return api;
}

it("agendamentosParaConfirmar filtra por janela e status agendado", async () => {
  const c = fakeClient([{ id: "1" }]);
  const a = new Agenda(c);
  const out = await a.agendamentosParaConfirmar("2026-06-04T00:00:00Z", "2026-06-04T23:59:59Z");
  expect(c.from).toHaveBeenCalledWith("agendamentos");
  expect(out).toHaveLength(1);
});

it("procedimentoPorNome ignora maiúsculas, espaços e acentos", async () => {
  const procedimento = { id: "p1", nome: "Avaliação facial", duracao_min: 60 };
  const a = new Agenda(fakeClient([procedimento]));
  await expect(a.procedimentoPorNome("  avaliacao FACIAL  ")).resolves.toEqual(procedimento);
});

it("procedimentoPorNome retorna null e avisa quando não encontra", async () => {
  const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const a = new Agenda(fakeClient([{ id: "p1", nome: "Botox" }]));
    await expect(a.procedimentoPorNome("Limpeza de pele")).resolves.toBeNull();
    expect(aviso).toHaveBeenCalledWith("[agenda] procedimento não encontrado para:", "Limpeza de pele");
  } finally {
    aviso.mockRestore();
  }
});
