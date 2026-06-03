import { it, expect, vi } from "vitest";
import { runConfirmador } from "../src/agents/confirmador";

it("envia confirmação pra cada agendamento de amanhã e loga", async () => {
  const agenda: any = {
    agendamentosParaConfirmar: vi.fn().mockResolvedValue([
      { id: "a1", cliente_id: "c1", inicio: "2026-06-04T17:00:00Z" },
    ]),
    clientePorId: vi.fn().mockResolvedValue({ nome: "Ana", telefone: "5585..." }),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runConfirmador({ agenda, wa, agora: new Date("2026-06-03T12:00:00Z") } as any);
  expect(wa.send).toHaveBeenCalledOnce();
  expect(wa.send.mock.calls[0][1]).toContain("Ana");
  expect(agenda.logMensagem).toHaveBeenCalledWith("5585...","out",expect.any(String),"confirmador");
});
