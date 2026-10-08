import { describe, it, expect, vi } from "vitest";
// @ts-ignore - js sem tipos
import * as agenda from "../painel/agenda.js";
// @ts-ignore - fonte do painel lida como texto (o app.js importa do CDN e mexe no DOM, não roda no vitest)
import appSrc from "../painel/app.js?raw";
// @ts-ignore
import configSrc from "../painel/config.example.js?raw";

const { FUSO_PADRAO, resolverFuso, hojeISO, addDiasISO, janelaDia, fmtHora, rotuloDia,
  criarSequencia, atualizarStatusAgendamento, atualizarProcedimento } = agenda as any;
const app = appSrc as string;

// ─── (a) fuso da agenda ───────────────────────────────────────────────────────
describe("dia da agenda no fuso da clínica", () => {
  it("23h30 em São Paulo ainda é o dia local, embora já seja o dia seguinte em UTC", () => {
    const agora = new Date("2026-06-04T02:30:00Z"); // 03/06 23:30 BRT
    expect(hojeISO("America/Sao_Paulo", agora)).toBe("2026-06-03");
    expect(agora.toISOString().slice(0, 10)).toBe("2026-06-04"); // o que o código antigo usava
  });
  it("hojeISO respeita outro fuso (Lisboa, verão)", () => {
    expect(hojeISO("Europe/Lisbon", new Date("2026-06-03T23:30:00Z"))).toBe("2026-06-04");
  });
  it("janelaDia é [00:00, 24:00) local em UTC, não [00:00Z, 23:59:59Z]", () => {
    expect(janelaDia("2026-06-04", "America/Sao_Paulo")).toEqual({
      de: "2026-06-04T03:00:00.000Z",
      ate: "2026-06-05T03:00:00.000Z",
    });
    expect(janelaDia("2026-06-04", "Europe/Lisbon")).toEqual({
      de: "2026-06-03T23:00:00.000Z",
      ate: "2026-06-04T23:00:00.000Z",
    });
  });
  it("consulta das 22h BRT cai no dia certo; a de 01h BRT do dia seguinte fica de fora", () => {
    const { de, ate } = janelaDia("2026-06-04", "America/Sao_Paulo");
    const dentro = (iso: string) => iso >= de && iso < ate;
    expect(dentro("2026-06-05T01:00:00.000Z")).toBe(true);  // 04/06 22:00 BRT
    expect(dentro("2026-06-05T04:00:00.000Z")).toBe(false); // 05/06 01:00 BRT
    expect(dentro("2026-06-04T02:00:00.000Z")).toBe(false); // 03/06 23:00 BRT
  });
  it("virada de horário de verão: o dia tem 23h ou 25h", () => {
    const j = janelaDia("2026-03-29", "Europe/Lisbon"); // adianta 1h às 01:00 UTC
    expect(j).toEqual({ de: "2026-03-29T00:00:00.000Z", ate: "2026-03-29T23:00:00.000Z" });
  });
  it("meia-noite que não existe (horário de verão à 00:00) começa no fim da lacuna", () => {
    // Brasil, 04/11/2018: 00:00 virou 01:00 (UTC-3 -> UTC-2)
    expect(janelaDia("2018-11-04", "America/Sao_Paulo")).toEqual({
      de: "2018-11-04T03:00:00.000Z",
      ate: "2018-11-05T02:00:00.000Z",
    });
    // o dia anterior termina exatamente onde este começa: sem sobreposição nem buraco
    expect(janelaDia("2018-11-03", "America/Sao_Paulo").ate).toBe("2018-11-04T03:00:00.000Z");
  });
  it("fim do horário de verão à 00:00 (dia com 25h)", () => {
    // Brasil, 18/02/2018: 00:00 voltou para 23:00 de 17/02 (UTC-2 -> UTC-3)
    expect(janelaDia("2018-02-17", "America/Sao_Paulo")).toEqual({
      de: "2018-02-17T02:00:00.000Z",
      ate: "2018-02-18T03:00:00.000Z",
    });
    expect(janelaDia("2018-02-18", "America/Sao_Paulo").de).toBe("2018-02-18T03:00:00.000Z");
  });
  it("fuso com meia hora (Índia) e fuso a leste do UTC+12", () => {
    expect(janelaDia("2026-06-04", "Asia/Kolkata").de).toBe("2026-06-03T18:30:00.000Z");
    expect(janelaDia("2026-06-04", "Pacific/Kiritimati").de).toBe("2026-06-03T10:00:00.000Z");
    expect(janelaDia("2026-06-04", "Pacific/Pago_Pago").de).toBe("2026-06-04T11:00:00.000Z");
  });
  it("addDiasISO anda no calendário sem depender do navegador", () => {
    expect(addDiasISO("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDiasISO("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("hora e rótulo saem no fuso da clínica", () => {
    expect(fmtHora("2026-06-04T17:00:00Z", "America/Sao_Paulo")).toBe("14:00");
    expect(fmtHora("2026-06-04T17:00:00Z", "Europe/Lisbon")).toBe("18:00");
    expect(rotuloDia("2026-06-04", "America/Sao_Paulo", new Date("2026-06-04T15:00:00Z"))).toBe("Hoje");
    expect(rotuloDia("2026-06-04", "America/Sao_Paulo", new Date("2026-06-10T15:00:00Z"))).toMatch(/04\/06/);
  });
  it("fuso vazio ou inválido volta ao padrão", () => {
    for (const ruim of [undefined, "", "  ", "Marte/Olimpo", 3]) expect(resolverFuso(ruim)).toBe(FUSO_PADRAO);
    expect(resolverFuso(" Europe/Lisbon ")).toBe("Europe/Lisbon");
  });
  it("o app.js usa a janela no fuso da clínica, não data crua nem UTC", () => {
    expect(app).toContain("janelaDia(dia, TZ)");
    expect(app).toContain(".lt('inicio', ate)");
    expect(app).not.toMatch(/T23:59:59/);
    expect(app).not.toMatch(/toLocaleDateString\('sv'\)/);
    expect(app).not.toMatch(/new Date\(ts\)\.toLocale/);
    expect(app).toContain("resolverFuso(cfg.TIMEZONE)");
  });
  it("config.example.js declara o TIMEZONE do painel", () => {
    expect(configSrc as string).toMatch(/TIMEZONE:\s*"America\/Sao_Paulo"/);
  });
});

// ─── (b) resposta atrasada ────────────────────────────────────────────────────
describe("resposta atrasada não sobrescreve a mais nova", () => {
  it("só o token da última requisição é atual", () => {
    const seq = criarSequencia();
    const velha = seq.nova();
    const nova = seq.nova();
    expect(seq.atual(velha)).toBe(false);
    expect(seq.atual(nova)).toBe(true);
  });
  it("simulação: a resposta lenta do dia 1 chega depois da do dia 2 e é descartada", async () => {
    const seq = criarSequencia();
    let tela = "";
    const render = async (dia: string, atrasoMs: number) => {
      const t = seq.nova();
      await new Promise((r) => setTimeout(r, atrasoMs));
      if (!seq.atual(t)) return;
      tela = dia;
    };
    await Promise.all([render("dia-1", 30), render("dia-2", 1)]);
    expect(tela).toBe("dia-2");
  });
  it("o app.js confere o token depois de cada await das cinco telas", () => {
    for (const nome of ["Agenda", "Clientes", "Procedimentos", "Espera", "Mensagens"]) {
      expect(app).toContain(`const token = seq${nome}.nova();`);
      expect(app).toContain(`if (!seq${nome}.atual(token)) return;`);
    }
    // agenda e espera têm dois awaits: o cache de procedimentos (compartilhado) também confere o token
    expect(app).toContain("const procs = await loadProcedimentosCache(seqAgenda, token);");
    expect(app).toContain("const procs = await loadProcedimentosCache(seqEspera, token);");
    expect((app.match(/if \(!procs\.atual\) return;/g) ?? []).length).toBe(2);
    expect((app.match(/if \(procs\.error\) \{/g) ?? []).length).toBe(2);   // falha do cache aparece, não vira "sem nome"
    expect(app).toMatch(/if \(!seq\.atual\(token\)\) return \{ atual: false/);
    expect(app).not.toContain("await loadProcedimentosCache();");
  });
});

// ─── (c) + (d) update confere linhas e status ─────────────────────────────────
function fakeUpdate(resposta: { data: any; error: any }) {
  const chamadas: Record<string, any[]> = { update: [], eq: [], select: [] };
  const api: any = {};
  api.from = vi.fn().mockReturnValue(api);
  api.update = vi.fn((p) => { chamadas.update!.push(p); return api; });
  api.eq = vi.fn((c, v) => { chamadas.eq!.push([c, v]); return api; });
  api.select = vi.fn((c) => { chamadas.select!.push(c); return api; });
  api.then = (res: any) => res(resposta);
  return { api, chamadas };
}

describe("atualizarStatusAgendamento", () => {
  it("(d) filtra pelo id E pelo status que a tela mostrou", async () => {
    const { api, chamadas } = fakeUpdate({ data: [{ id: "a1" }], error: null });
    const r = await atualizarStatusAgendamento(api, { id: "a1", de: "agendado", para: "realizado" });
    expect(r).toEqual({ ok: true });
    expect(chamadas.eq).toEqual([["id", "a1"], ["status", "agendado"]]);
    expect(chamadas.update).toEqual([{ status: "realizado" }]);
  });
  it("(c) 0 linhas afetadas é falha visível (conflito), não sucesso", async () => {
    const { api } = fakeUpdate({ data: [], error: null });
    const r = await atualizarStatusAgendamento(api, { id: "a1", de: "agendado", para: "realizado" });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("conflito");
    expect(r.mensagem).toMatch(/mudou de status/);
  });
  it("(c) data nulo (sem retorno) também não conta como sucesso", async () => {
    const { api } = fakeUpdate({ data: null, error: null });
    expect((await atualizarStatusAgendamento(api, { id: "a1", de: "agendado", para: "faltou" })).ok).toBe(false);
  });
  it("erro do banco continua sendo erro", async () => {
    const { api } = fakeUpdate({ data: null, error: { message: "boom" } });
    expect(await atualizarStatusAgendamento(api, { id: "a1", de: "agendado", para: "faltou" }))
      .toEqual({ ok: false, motivo: "erro", mensagem: "boom" });
  });
  it("confirmado grava confirmado_em", async () => {
    const { api, chamadas } = fakeUpdate({ data: [{ id: "a1" }], error: null });
    await atualizarStatusAgendamento(api, { id: "a1", de: "agendado", para: "confirmado", agora: new Date("2026-06-04T12:00:00Z") });
    expect(chamadas.update).toEqual([{ status: "confirmado", confirmado_em: "2026-06-04T12:00:00.000Z" }]);
  });
  it("o botão carrega o status atual e o app.js o repassa", () => {
    expect((app.match(/data-status="\$\{escHtml\(ag\.status\)\}"/g) ?? []).length).toBe(4);
    expect(app).toContain("handleAgendaAction(btn.dataset.id, btn.dataset.action, btn.dataset.status)");
    expect(app).toContain("atualizarStatusAgendamento(sb, { id, de: statusAtual, para: novoStatus })");
  });
});

describe("atualizarProcedimento", () => {
  it("(c) 0 linhas afetadas é falha", async () => {
    const { api, chamadas } = fakeUpdate({ data: [], error: null });
    const r = await atualizarProcedimento(api, { id: "p1", duracao_min: 30, cadencia_retorno_dias: null });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("sem-linha");
    expect(chamadas.eq).toEqual([["id", "p1"]]);
  });
  it("uma linha atualizada é sucesso", async () => {
    const { api } = fakeUpdate({ data: [{ id: "p1" }], error: null });
    expect(await atualizarProcedimento(api, { id: "p1", duracao_min: 30, cadencia_retorno_dias: 90 })).toEqual({ ok: true });
  });
  it("o app.js não faz mais update direto sem conferir linhas", () => {
    expect(app).not.toMatch(/\.update\(/);
    expect(app).toContain("atualizarProcedimento(sb,");
  });
});
