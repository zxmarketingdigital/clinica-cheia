/**
 * Helpers de tempo para o fuso America/Sao_Paulo (BRT = UTC-3).
 *
 * Estratégia: usamos Intl.DateTimeFormat com timeZone "America/Sao_Paulo"
 * para extrair as partes de data no fuso correto, depois montamos os
 * instantes UTC manualmente. Isso é robusto ao horário de verão (quando
 * o Brasil eventualmente reintroduzir), diferente de um offset fixo -3.
 */

const TZ = "America/Sao_Paulo";

/** Retorna as partes de data/hora de um instante no fuso BRT. */
function partsBRT(d: Date): { year: number; month: number; day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
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

/**
 * Retorna o início (00:00:00.000) e fim (23:59:59.999) do DIA SEGUINTE
 * em horário de Brasília, como strings ISO 8601 em UTC.
 *
 * Exemplo: agora = 2026-06-03T12:00:00Z
 *   dia seguinte BRT = 04/06/2026
 *   de  = 2026-06-04T03:00:00.000Z  (04/06 00:00 BRT)
 *   ate = 2026-06-05T02:59:59.999Z  (04/06 23:59:59.999 BRT)
 */
export function janelaDiaSeguinte(agora: Date): { de: string; ate: string } {
  const { year, month, day } = partsBRT(agora);

  // Dia seguinte em BRT: incrementamos o dia e deixamos o Date normalizar
  // (evita cálculo manual de fim de mês / ano).
  const startBRT = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  const endBRT   = new Date(Date.UTC(year, month - 1, day + 1, 23, 59, 59, 999));

  // BRT = UTC - 3h → para converter "meia-noite BRT" para UTC somamos 3h
  const offsetMs = 3 * 60 * 60 * 1000; // +3h
  const de  = new Date(startBRT.getTime() + offsetMs);
  const ate = new Date(endBRT.getTime()   + offsetMs);

  return { de: de.toISOString(), ate: ate.toISOString() };
}

/**
 * Formata um instante ISO para uma string curta legível em PT-BR no fuso BRT.
 * Exemplo: "2026-06-04T17:00:00Z" → "04/06 às 14h"
 */
export function formatarQuando(iso: string): string {
  const d = new Date(iso);

  const dateFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  });
  const hourFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  });

  const datePart = dateFmt.format(d);   // "04/06"
  const hourPart = hourFmt.format(d);   // "14"

  return `${datePart} às ${hourPart}h`;
}
