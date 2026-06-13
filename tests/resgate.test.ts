import { it, expect, vi } from "vitest";
import { runResgate, ofertarVaga } from "../src/agents/resgate";

it("marca falta e envia resgate", async () => {
  const agenda: any = {
    faltasRecentes: vi.fn().mockResolvedValue([{ id:"a1", cliente:{nome:"Ana",telefone:"55..."} }]),
    marcarFaltou: vi.fn().mockResolvedValue(undefined),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runResgate({ agenda, wa, agora: new Date() } as any);
  expect(agenda.marcarFaltou).toHaveBeenCalledWith("a1");
  expect(wa.send.mock.calls[0]![1]).toContain("Ana");
});

// FIX C2 — runResgate deve chamar faltasRecentes com DOIS argumentos (janela fechada)
it("runResgate chama faltasRecentes com janela de dois argumentos (dia anterior)", async () => {
  const agenda: any = {
    faltasRecentes: vi.fn().mockResolvedValue([]),
    marcarFaltou: vi.fn().mockResolvedValue(undefined),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runResgate({ agenda, wa, agora: new Date("2026-06-03T12:00:00Z") } as any);
  expect(agenda.faltasRecentes).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String)
  );
  const [de, ate] = agenda.faltasRecentes.mock.calls[0]!;
  // de < ate, e ambos são strings ISO UTC
  expect(new Date(de).getTime()).toBeLessThan(new Date(ate).getTime());
});

// FIX I2 — erro no 1º item não deve impedir envio do 2º
it("runResgate continua após erro num item (não aborta o batch)", async () => {
  const faltas = [
    { id: "a1", cliente: { nome: "Ana", telefone: "55..." } },
    { id: "a2", cliente: { nome: "Bia", telefone: "56..." } },
  ];
  const agenda: any = {
    faltasRecentes: vi.fn().mockResolvedValue(faltas),
    // marcarFaltou falha no primeiro, ok no segundo
    marcarFaltou: vi.fn()
      .mockRejectedValueOnce(new Error("db error"))
      .mockResolvedValue(undefined),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runResgate({ agenda, wa, agora: new Date() } as any);
  // wa.send deve ter sido chamado apenas para o 2º (1º falhou em marcarFaltou antes do send)
  expect(wa.send).toHaveBeenCalledOnce();
  expect(wa.send.mock.calls[0]![1]).toContain("Bia");
});

it("oferta vaga aberta ao próximo da lista de espera e marca atendido", async () => {
  const agenda: any = {
    proximoListaEspera: vi.fn().mockResolvedValue({ id:"l1", cliente:{nome:"Bia",telefone:"56..."} }),
    marcarListaEsperaAtendido: vi.fn().mockResolvedValue(undefined),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await ofertarVaga({ agenda, wa, agora: new Date() } as any, "p1");
  expect(agenda.marcarListaEsperaAtendido).toHaveBeenCalledWith("l1");
  expect(wa.send.mock.calls[0]![1]).toContain("Bia");
  // FIX copy — deve usar convidarVaga, não "senti sua falta"
  expect(wa.send.mock.calls[0]![1]).not.toContain("senti sua falta");
  expect(wa.send.mock.calls[0]![1]).toContain("Abriu uma vaga");
});

it("ofertarVaga sem ninguém na lista não envia nada", async () => {
  const agenda: any = { proximoListaEspera: vi.fn().mockResolvedValue(null), logMensagem: vi.fn(), clienteOptOut: async () => false };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await ofertarVaga({ agenda, wa, agora: new Date() } as any, "p1");
  expect(wa.send).not.toHaveBeenCalled();
});
