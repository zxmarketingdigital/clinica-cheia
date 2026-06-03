import { it, expect, describe } from "vitest";
import { cadenciaVencida } from "../src/lib/cadencia";

const ana = { nome: "Ana", telefone: "55a" };
const bea = { nome: "Bea", telefone: "55b" };

describe("cadenciaVencida", () => {
  it("inclui cadência vencida e ignora cadencia_retorno_dias null", () => {
    const rows = [
      {
        cliente: ana,
        procedimento: { nome: "Botox", cadencia_retorno_dias: 150 },
        inicio: "2026-01-01T12:00:00Z",
      },
      {
        cliente: ana,
        procedimento: { nome: "Avaliação", cadencia_retorno_dias: null },
        inicio: "2026-01-01T12:00:00Z",
      },
    ];
    // ~153 dias do Botox
    const out = cadenciaVencida(rows, "2026-06-03T12:00:00Z");
    expect(out).toHaveLength(1);
    expect(out[0]!.procedimento.nome).toBe("Botox");
  });

  it("usa o realizado mais recente do grupo e respeita não-vencida", () => {
    const rows = [
      {
        cliente: ana,
        procedimento: { nome: "Limpeza", cadencia_retorno_dias: 30 },
        inicio: "2026-01-01T12:00:00Z",
      },
      {
        cliente: ana,
        procedimento: { nome: "Limpeza", cadencia_retorno_dias: 30 },
        inicio: "2026-06-01T12:00:00Z",
      },
    ];
    // último foi 01/06, só 9 dias atrás — não está vencido
    expect(cadenciaVencida(rows, "2026-06-10T12:00:00Z")).toHaveLength(0);
  });

  it("inclui quando exatamente na cadência (dias == cadencia_retorno_dias)", () => {
    const rows = [
      {
        cliente: ana,
        procedimento: { nome: "Preenchimento", cadencia_retorno_dias: 365 },
        inicio: "2025-06-03T12:00:00Z",
      },
    ];
    // exatamente 365 dias depois
    const out = cadenciaVencida(rows, "2026-06-03T12:00:00Z");
    expect(out).toHaveLength(1);
    expect(out[0]!.cliente.telefone).toBe("55a");
  });

  it("não inclui quando um dia antes de vencer", () => {
    const rows = [
      {
        cliente: ana,
        procedimento: { nome: "Botox", cadencia_retorno_dias: 150 },
        inicio: "2026-01-03T12:00:00Z",
      },
    ];
    // 149 dias — ainda não vencido
    const out = cadenciaVencida(rows, "2026-06-01T12:00:00Z");
    expect(out).toHaveLength(0);
  });

  it("agrupa corretamente dois clientes diferentes no mesmo procedimento", () => {
    const rows = [
      {
        cliente: ana,
        procedimento: { nome: "Botox", cadencia_retorno_dias: 150 },
        inicio: "2026-01-01T12:00:00Z",
      },
      {
        cliente: bea,
        procedimento: { nome: "Botox", cadencia_retorno_dias: 150 },
        inicio: "2026-06-01T12:00:00Z", // recente — não vencido
      },
    ];
    const out = cadenciaVencida(rows, "2026-06-03T12:00:00Z");
    expect(out).toHaveLength(1);
    expect(out[0]!.cliente.telefone).toBe("55a");
  });

  it("retorna o campo ultimo correto (ISO do mais recente)", () => {
    const rows = [
      {
        cliente: ana,
        procedimento: { nome: "Limpeza", cadencia_retorno_dias: 30 },
        inicio: "2025-12-01T12:00:00Z",
      },
      {
        cliente: ana,
        procedimento: { nome: "Limpeza", cadencia_retorno_dias: 30 },
        inicio: "2026-01-01T12:00:00Z",
      },
    ];
    const out = cadenciaVencida(rows, "2026-06-03T12:00:00Z");
    expect(out).toHaveLength(1);
    expect(out[0]!.ultimo).toBe("2026-01-01T12:00:00Z");
  });
});
