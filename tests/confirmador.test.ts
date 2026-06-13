import { it, expect, vi } from "vitest";
import { runConfirmador } from "../src/agents/confirmador";

it("envia confirmação pra cada agendamento de amanhã e loga", async () => {
  const agenda: any = {
    agendamentosParaConfirmar: vi.fn().mockResolvedValue([
      { id: "a1", cliente_id: "c1", inicio: "2026-06-04T17:00:00Z" },
    ]),
    clientePorId: vi.fn().mockResolvedValue({ nome: "Ana", telefone: "5585..." }),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runConfirmador({ agenda, wa, agora: new Date("2026-06-03T12:00:00Z") } as any);
  expect(wa.send).toHaveBeenCalledOnce();
  expect(wa.send.mock.calls[0]![1]).toContain("Ana");
  expect(agenda.logMensagem).toHaveBeenCalledWith("5585...","out",expect.any(String),"confirmador");
});

// FIX I2 — erro num item não deve abortar o batch; o 2º deve ser enviado mesmo se o 1º falhar
it("continua para o próximo agendamento quando wa.send rejeita no primeiro", async () => {
  const agenda: any = {
    agendamentosParaConfirmar: vi.fn().mockResolvedValue([
      { id: "a1", cliente_id: "c1", inicio: "2026-06-04T17:00:00Z" },
      { id: "a2", cliente_id: "c2", inicio: "2026-06-04T18:00:00Z" },
    ]),
    clientePorId: vi.fn()
      .mockResolvedValueOnce({ nome: "Ana", telefone: "5585..." })
      .mockResolvedValueOnce({ nome: "Bia", telefone: "5586..." }),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = {
    send: vi.fn()
      .mockRejectedValueOnce(new Error("400 Bad Request"))
      .mockResolvedValueOnce(undefined),
  };
  await runConfirmador({ agenda, wa, agora: new Date("2026-06-03T12:00:00Z") } as any);
  // wa.send deve ter sido chamado 2× — o 2º não foi pulado mesmo com erro no 1º
  expect(wa.send).toHaveBeenCalledTimes(2);
  expect(wa.send.mock.calls[1]![1]).toContain("Bia");
});
