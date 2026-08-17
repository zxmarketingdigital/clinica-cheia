/**
 * Helpers de tempo para o fuso configurado pela clínica.
 *
 * Estratégia: usamos Intl.DateTimeFormat com o timeZone configurado para
 * extrair as partes de data no fuso correto, depois montamos os instantes
 * UTC manualmente. O offset é obtido do próprio Intl em cada limite da
 * janela, então horários de verão e fusos fora do Brasil são respeitados.
 */

import { DEFAULT_TIMEZONE } from "../config";

type Timezone = string;

/** Retorna as partes de data/hora de um instante no fuso configurado. */
function partsLocal(d: Date, timezone: Timezone): { year: number; month: number; day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

/** Converte o valor GMT/UTC retornado por Intl em milissegundos. */
function offsetDoFuso(d: Date, timezone: Timezone): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  }).formatToParts(d);
  const nome = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = nome.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const horas = Number(match[2]);
  const minutos = Number(match[3] ?? "0");
  const sinal = match[1] === "+" ? 1 : -1;
  return sinal * (horas * 60 + minutos) * 60 * 1000;
}

/** Converte um relógio local representado artificialmente em UTC. */
function localParaUTC(local: Date, timezone: Timezone): Date {
  // O offset positivo representa quanto o relógio local está à frente do UTC;
  // por isso ele é subtraído do relógio local para obter o instante.
  let offsetMs = offsetDoFuso(local, timezone);
  let utcMs = local.getTime() - offsetMs;

  // Recalcula no instante candidato para cobrir transições de horário de verão
  // próximas ao limite da janela.
  offsetMs = offsetDoFuso(new Date(utcMs), timezone);
  utcMs = local.getTime() - offsetMs;
  return new Date(utcMs);
}

/**
 * Retorna o início (00:00:00.000) e fim (23:59:59.999) do DIA SEGUINTE
 * no fuso configurado, como strings ISO 8601 em UTC.
 *
 * Exemplo: agora = 2026-06-03T12:00:00Z
 *   dia seguinte BRT = 04/06/2026
 *   de  = 2026-06-04T03:00:00.000Z  (04/06 00:00 BRT)
 *   ate = 2026-06-05T02:59:59.999Z  (04/06 23:59:59.999 BRT)
 */
export function janelaDiaSeguinte(agora: Date, timezone = DEFAULT_TIMEZONE): { de: string; ate: string } {
  const { year, month, day } = partsLocal(agora, timezone);

  // Dia seguinte no fuso local: incrementamos o dia e deixamos o Date normalizar
  // (evita cálculo manual de fim de mês / ano).
  const startBRT = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  const endBRT   = new Date(Date.UTC(year, month - 1, day + 1, 23, 59, 59, 999));

  const de = localParaUTC(startBRT, timezone);
  const ate = localParaUTC(endBRT, timezone);

  return { de: de.toISOString(), ate: ate.toISOString() };
}

/**
 * Retorna o início (00:00:00.000) e fim (23:59:59.999) do DIA ANTERIOR
 * no fuso configurado, como strings ISO 8601 em UTC.
 *
 * Exemplo: agora = 2026-06-03T12:00:00Z
 *   dia anterior BRT = 02/06/2026
 *   de  = 2026-06-02T03:00:00.000Z  (02/06 00:00 BRT)
 *   ate = 2026-06-03T02:59:59.999Z  (02/06 23:59:59.999 BRT)
 */
export function janelaDiaAnterior(agora: Date, timezone = DEFAULT_TIMEZONE): { de: string; ate: string } {
  const { year, month, day } = partsLocal(agora, timezone);

  // Dia anterior no fuso local: decrementamos o dia e deixamos o Date normalizar.
  const startBRT = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0, 0));
  const endBRT   = new Date(Date.UTC(year, month - 1, day - 1, 23, 59, 59, 999));

  const de = localParaUTC(startBRT, timezone);
  const ate = localParaUTC(endBRT, timezone);

  return { de: de.toISOString(), ate: ate.toISOString() };
}

/**
 * Normaliza uma string ISO (potencialmente com offset, ex: "-03:00") para
 * UTC puro ("...Z"). Garante que comparações de string ISO sejam consistentes.
 * Exemplo: "2026-06-10T14:00:00-03:00" → "2026-06-10T17:00:00.000Z"
 */
export function paraUTC(iso: string): string {
  return new Date(iso).toISOString();
}

/**
 * Formata um instante ISO para uma string curta legível no fuso configurado.
 * Exemplo: "2026-06-04T17:00:00Z" → "04/06 às 14h"
 */
export function formatarQuando(iso: string, timezone = DEFAULT_TIMEZONE): string {
  const d = new Date(iso);

  const dateFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
  });
  const hourFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });

  const datePart = dateFmt.format(d);   // "04/06"
  const hourPart = hourFmt.format(d);   // "14"

  return `${datePart} às ${hourPart}h`;
}
