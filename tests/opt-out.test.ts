import { it, expect, vi } from "vitest";
import { handleInbound } from "../src/agents/recepcionista";
import { runConfirmador } from "../src/agents/confirmador";
import { sendProativo } from "../src/lib/envio";

// "SAIR" marca opt-out, confirma ao cliente e NÃO chama o LLM.
it("inbound SAIR marca opt-out e responde sem chamar o LLM", async () => {
  const llm = vi.fn();
  const agenda: any = {
    logMensagem: vi.fn().mockResolvedValue(undefined),
    marcarOptOut: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await handleInbound({ telefone: "5599", texto: " sair " }, { llm, agenda, wa } as any);
  expect(agenda.marcarOptOut).toHaveBeenCalledWith("5599");
  expect(llm).not.toHaveBeenCalled();
  expect(wa.send).toHaveBeenCalledOnce();
});

// sendProativo (chokepoint) bloqueia envio quando o cliente está em opt-out.
it("sendProativo não envia nem loga quando cliente em opt-out", async () => {
  const agenda: any = {
    clienteOptOut: async () => true,
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  const enviou = await sendProativo({ agenda, wa } as any, "5599", "oi", "confirmador");
  expect(enviou).toBe(false);
  expect(wa.send).not.toHaveBeenCalled();
  expect(agenda.logMensagem).not.toHaveBeenCalled();
});

// Um agente proativo (confirmador) respeita opt-out via sendProativo.
it("confirmador não envia a cliente em opt-out", async () => {
  const agenda: any = {
    agendamentosParaConfirmar: vi.fn().mockResolvedValue([{ id: "a1", cliente_id: "c1", inicio: "2026-06-10T17:00:00Z" }]),
    clientePorId: vi.fn().mockResolvedValue({ nome: "Ana", telefone: "5599" }),
    clienteOptOut: async () => true,
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runConfirmador({ agenda, wa, agora: new Date("2026-06-09T12:00:00Z") } as any);
  expect(wa.send).not.toHaveBeenCalled();
});
