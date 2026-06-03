import { it, expect, vi } from "vitest";
import { runResgate, ofertarVaga } from "../src/agents/resgate";

it("marca falta e envia resgate", async () => {
  const agenda: any = {
    faltasRecentes: vi.fn().mockResolvedValue([{ id:"a1", cliente:{nome:"Ana",telefone:"55..."} }]),
    marcarFaltou: vi.fn().mockResolvedValue(undefined),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runResgate({ agenda, wa, agora: new Date() } as any);
  expect(agenda.marcarFaltou).toHaveBeenCalledWith("a1");
  expect(wa.send.mock.calls[0][1]).toContain("Ana");
});

it("oferta vaga aberta ao próximo da lista de espera e marca atendido", async () => {
  const agenda: any = {
    proximoListaEspera: vi.fn().mockResolvedValue({ id:"l1", cliente:{nome:"Bia",telefone:"56..."} }),
    marcarListaEsperaAtendido: vi.fn().mockResolvedValue(undefined),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await ofertarVaga({ agenda, wa, agora: new Date() } as any, "p1");
  expect(agenda.marcarListaEsperaAtendido).toHaveBeenCalledWith("l1");
  expect(wa.send.mock.calls[0][1]).toContain("Bia");
});

it("ofertarVaga sem ninguém na lista não envia nada", async () => {
  const agenda: any = { proximoListaEspera: vi.fn().mockResolvedValue(null), logMensagem: vi.fn() };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await ofertarVaga({ agenda, wa, agora: new Date() } as any, "p1");
  expect(wa.send).not.toHaveBeenCalled();
});
