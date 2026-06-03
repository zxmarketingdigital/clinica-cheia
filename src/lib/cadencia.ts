export interface RealizadoRow {
  cliente: { nome: string; telefone: string };
  procedimento: { nome: string; cadencia_retorno_dias: number | null };
  inicio: string; // ISO do agendamento realizado
}

export interface CadenciaVencida {
  cliente: { nome: string; telefone: string };
  procedimento: { nome: string };
  ultimo: string;
}

/**
 * Função PURA: recebe linhas já buscadas do banco e uma data de referência,
 * retorna apenas os (cliente, procedimento) com cadência vencida.
 *
 * Agrupamento: telefone + "|" + procedimento.nome
 * Para cada grupo, pega o inicio MÁXIMO (mais recente).
 * Inclui no resultado SE cadencia_retorno_dias != null
 *   E Math.floor((ref - ultimo) em ms / 86400000) >= cadencia_retorno_dias.
 */
export function cadenciaVencida(
  rows: RealizadoRow[],
  refISO: string
): CadenciaVencida[] {
  const refMs = new Date(refISO).getTime();

  // Agrupa por chave e mantém a linha mais recente
  const grupos = new Map<string, RealizadoRow>();

  for (const row of rows) {
    const chave = row.cliente.telefone + "|" + row.procedimento.nome;
    const existing = grupos.get(chave);
    if (!existing || row.inicio > existing.inicio) {
      grupos.set(chave, row);
    }
  }

  const resultado: CadenciaVencida[] = [];

  for (const row of grupos.values()) {
    const { cadencia_retorno_dias } = row.procedimento;
    if (cadencia_retorno_dias === null) continue;

    const ultimoMs = new Date(row.inicio).getTime();
    const diasDecorridos = Math.floor((refMs - ultimoMs) / 86400000);

    if (diasDecorridos >= cadencia_retorno_dias) {
      resultado.push({
        cliente: { nome: row.cliente.nome, telefone: row.cliente.telefone },
        procedimento: { nome: row.procedimento.nome },
        ultimo: row.inicio,
      });
    }
  }

  return resultado;
}
