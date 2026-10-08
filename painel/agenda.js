// painel/agenda.js — lógica da agenda do painel, sem DOM e sem CDN (testável no vitest).
//
// O app.js importa daqui. Três responsabilidades:
//   1. Dia da agenda no FUSO DA CLÍNICA (TIMEZONE do painel/config.js), nunca no UTC/relógio do navegador.
//   2. Descartar resposta atrasada: a requisição mais nova sempre vence.
//   3. Escrita no banco que confere linhas afetadas (e, no agendamento, o status esperado).

/** Mesmo padrão de src/config.ts (DEFAULT_TIMEZONE). */
export const FUSO_PADRAO = "America/Sao_Paulo";

/**
 * Devolve um fuso IANA válido; vazio, não-texto ou inválido volta ao padrão.
 * @param {unknown} valor
 * @returns {string}
 */
export function resolverFuso(valor) {
  if (typeof valor !== "string" || valor.trim() === "") return FUSO_PADRAO;
  const tz = valor.trim();
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return FUSO_PADRAO;
  }
}

/**
 * Data de hoje ("YYYY-MM-DD") no fuso da clínica.
 * @param {string} [fuso] @param {Date} [agora]
 */
export function hojeISO(fuso = FUSO_PADRAO, agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolverFuso(fuso), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const pega = (t) => partes.find((p) => p.type === t)?.value ?? "";
  return `${pega("year")}-${pega("month")}-${pega("day")}`;
}

/**
 * Soma dias a uma data "YYYY-MM-DD" (calendário puro, sem fuso nem horário de verão).
 * @param {string} iso @param {number} n
 */
export function addDiasISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Deslocamento (ms) do fuso em relação ao UTC num instante. @param {Date} d @param {string} fuso */
function offsetDoFuso(d, fuso) {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "shortOffset" })
    .formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = nome.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return 0;
  const minutos = Number(m[2]) * 60 + Number(m[3] ?? "0");
  return (m[1] === "+" ? 1 : -1) * minutos * 60 * 1000;
}

/** Meia-noite local de "YYYY-MM-DD" no fuso, como instante. */
function meiaNoiteLocal(iso, fuso) {
  const [y, m, d] = iso.split("-").map(Number);
  const relogio = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  let utc = relogio - offsetDoFuso(new Date(relogio), fuso);
  utc = relogio - offsetDoFuso(new Date(utc), fuso);   // 2ª passada: virada de horário de verão
  return new Date(utc);
}

/**
 * Janela [de, ate) do dia no fuso da clínica, em ISO UTC. Use `gte(de)` e `lt(ate)`.
 * @param {string} iso "YYYY-MM-DD" @param {string} [fuso]
 * @returns {{ de: string, ate: string }}
 */
export function janelaDia(iso, fuso = FUSO_PADRAO) {
  const tz = resolverFuso(fuso);
  return {
    de: meiaNoiteLocal(iso, tz).toISOString(),
    ate: meiaNoiteLocal(addDiasISO(iso, 1), tz).toISOString(),
  };
}

/** Hora "14:30" de um instante, no fuso da clínica. */
export function fmtHora(ts, fuso = FUSO_PADRAO) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: resolverFuso(fuso) });
}

/** "04/06, 14:30" de um instante, no fuso da clínica. */
export function fmtDataHora(ts, fuso = FUSO_PADRAO) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: resolverFuso(fuso),
  });
}

/** Rótulo do dia da agenda: "Hoje" ou "qui., 04/06". @param {string} iso */
export function rotuloDia(iso, fuso = FUSO_PADRAO, agora = new Date()) {
  if (iso === hojeISO(fuso, agora)) return "Hoje";
  const [y, m, d] = iso.split("-").map(Number);
  // meio-dia UTC + formatação em UTC: o dia do calendário não anda com o fuso do navegador
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC",
  });
}

/**
 * Sequência de requisições: só a mais recente (`atual`) pode escrever na tela.
 * const t = seq.nova(); ... await ...; if (!seq.atual(t)) return;
 */
export function criarSequencia() {
  let n = 0;
  return {
    nova: () => ++n,
    atual: (token) => token === n,
  };
}

/**
 * Muda o status de um agendamento só se ele AINDA estiver no status que a tela mostrou.
 * Outra transição concorrente (agente de confirmação, outra aba) vence; 0 linhas = falha visível.
 * @returns {Promise<{ ok: true } | { ok: false, motivo: "erro" | "conflito", mensagem: string }>}
 */
export async function atualizarStatusAgendamento(sb, { id, de, para, agora = new Date() }) {
  const patch = { status: para, ...(para === "confirmado" ? { confirmado_em: agora.toISOString() } : {}) };
  const { data, error } = await sb
    .from("agendamentos")
    .update(patch)
    .eq("id", id)
    .eq("status", de)
    .select("id");
  if (error) return { ok: false, motivo: "erro", mensagem: error.message };
  if (!Array.isArray(data) || data.length === 0) {
    return {
      ok: false,
      motivo: "conflito",
      mensagem: "Este agendamento mudou de status (ou não existe mais). Atualizei a agenda; confira e tente de novo.",
    };
  }
  return { ok: true };
}

/**
 * Salva duração/cadência de um procedimento; 0 linhas afetadas é falha (RLS, id removido).
 * @returns {Promise<{ ok: true } | { ok: false, motivo: "erro" | "sem-linha", mensagem: string }>}
 */
export async function atualizarProcedimento(sb, { id, duracao_min, cadencia_retorno_dias }) {
  const { data, error } = await sb
    .from("procedimentos")
    .update({ duracao_min, cadencia_retorno_dias })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, motivo: "erro", mensagem: error.message };
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, motivo: "sem-linha", mensagem: "Nada foi salvo: o procedimento não foi encontrado ou você não tem permissão." };
  }
  return { ok: true };
}
