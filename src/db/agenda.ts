import type { Agendamento, Cliente, Procedimento } from "./types";
import { cadenciaVencida } from "../lib/cadencia";
import type { CadenciaVencida } from "../lib/cadencia";

export class Agenda {
  constructor(private db: any) {}

  async agendamentosParaConfirmar(de: string, ate: string): Promise<Agendamento[]> {
    const { data, error } = await this.db
      .from("agendamentos")
      .select("*")
      .eq("status", "agendado")
      .gte("inicio", de)
      .lte("inicio", ate);
    if (error) throw error;
    return data ?? [];
  }

  async marcarConfirmado(id: string, quando: string) {
    const { error } = await this.db
      .from("agendamentos")
      .update({ status: "confirmado", confirmado_em: quando })
      .eq("id", id);
    if (error) throw error;
  }

  async upsertCliente(nome: string, telefone: string): Promise<Cliente> {
    const { data, error } = await this.db
      .from("clientes")
      .upsert({ nome, telefone }, { onConflict: "telefone" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async criarAgendamento(
    cliente_id: string,
    procedimento_id: string | null,
    inicio: string
  ): Promise<Agendamento> {
    const { data, error } = await this.db
      .from("agendamentos")
      .insert({ cliente_id, procedimento_id, inicio })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async procedimentoPorNome(nome: string): Promise<Procedimento | null> {
    const { data, error } = await this.db.from("procedimentos").select("*").eq("nome", nome).maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async clientePorId(id: string): Promise<Cliente> {
    const { data, error } = await this.db.from("clientes").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  async logMensagem(
    telefone: string,
    direcao: "in" | "out",
    corpo: string,
    agente?: string
  ) {
    await this.db.from("mensagens").insert({ telefone, direcao, corpo, agente });
  }

  /**
   * Retorna todos os (cliente, procedimento) com cadência de retorno vencida
   * em relação a refISO. A lógica de negócio fica isolada em cadenciaVencida()
   * (função pura, testada em tests/cadencia.test.ts).
   * Usa import estático de ../lib/cadencia para evitar dynamic import.
   */
  async realizadosComCadenciaVencendo(refISO: string): Promise<CadenciaVencida[]> {
    const { data, error } = await this.db
      .from("agendamentos")
      .select("inicio, clientes(nome,telefone), procedimentos(nome,cadencia_retorno_dias)")
      .eq("status", "realizado");
    if (error) throw error;
    const rows = (data ?? []).map((r: any) => ({
      cliente: { nome: r.clientes?.nome, telefone: r.clientes?.telefone },
      procedimento: {
        nome: r.procedimentos?.nome,
        cadencia_retorno_dias: r.procedimentos?.cadencia_retorno_dias ?? null,
      },
      inicio: r.inicio,
    }));
    return cadenciaVencida(rows, refISO);
  }

  /**
   * Retorna true se já enviou lembrete-retorno para esse telefone e procedimento
   * nos últimos 60 dias. Evita reenvio em execuções subsequentes do cron.
   *
   * Nota: não há teste unitário com fakeClient para este método porque o
   * fakeClient simples não modela .ilike/.limit bem. A lógica crítica de
   * cadência (o coração do agente) está coberta pelo teste PURO de cadencia.ts.
   */
  async jaEnviouLembrete(telefone: string, procedimentoNome: string): Promise<boolean> {
    const desde = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data, error } = await this.db
      .from("mensagens")
      .select("id")
      .eq("telefone", telefone)
      .eq("agente", "lembrete-retorno")
      .eq("direcao", "out")
      .gte("criado_em", desde)
      .ilike("corpo", `%${procedimentoNome}%`)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  }
}
