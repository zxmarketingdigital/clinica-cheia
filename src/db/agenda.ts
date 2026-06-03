import type { Agendamento, Cliente, Procedimento } from "./types";
import { cadenciaVencida } from "../lib/cadencia";
import type { CadenciaVencida } from "../lib/cadencia";
import { janelaDiaAnterior } from "../lib/tempo";

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
   * Agendamentos passados (inicio < agoraISO) cujo status ainda é agendado ou
   * confirmado — ou seja, o paciente não compareceu e o sistema ainda não
   * registrou o resultado. Retorna id + dados do cliente embutidos.
   *
   * Nota: não há teste com fakeClient aqui porque o mock da chain
   * (.in().lt()) é frágil. A lógica de negócio do agente é coberta em
   * tests/resgate.test.ts mockando a própria Agenda.
   */
  async faltasRecentes(agoraISO: string) {
    const { data, error } = await this.db
      .from("agendamentos")
      .select("id, inicio, status, clientes(nome,telefone)")
      .in("status", ["agendado", "confirmado"])
      .lt("inicio", agoraISO);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      cliente: { nome: r.clientes?.nome, telefone: r.clientes?.telefone },
    }));
  }

  /** Atualiza o status de um agendamento para "faltou". */
  async marcarFaltou(id: string): Promise<void> {
    const { error } = await this.db
      .from("agendamentos")
      .update({ status: "faltou" })
      .eq("id", id);
    if (error) throw error;
  }

  /**
   * Retorna o próximo item não atendido da lista de espera, ordenado por
   * data de criação (FIFO). Filtra por procedimento_id quando informado.
   *
   * Nota: não há teste com fakeClient aqui porque o mock da chain
   * (.eq(atendido).order().limit()) é frágil. A lógica do agente é
   * coberta em tests/resgate.test.ts mockando a Agenda.
   */
  async proximoListaEspera(procedimento_id: string | null) {
    let q = this.db
      .from("lista_espera")
      .select("id, clientes(nome,telefone)")
      .eq("atendido", false)
      .order("criado_em", { ascending: true })
      .limit(1);
    if (procedimento_id) q = q.eq("procedimento_id", procedimento_id);
    const { data, error } = await q;
    if (error) throw error;
    const r = (data ?? [])[0];
    return r
      ? { id: r.id, cliente: { nome: r.clientes?.nome, telefone: r.clientes?.telefone } }
      : null;
  }

  /** Marca um item da lista de espera como atendido, retirando-o da fila. */
  async marcarListaEsperaAtendido(id: string): Promise<void> {
    const { error } = await this.db
      .from("lista_espera")
      .update({ atendido: true })
      .eq("id", id);
    if (error) throw error;
  }

  /**
   * Clientes cujo agendamento mais recente é anterior a corteISO (ou que nunca
   * agendaram). Delega a agregação max(inicio) ao RPC clientes_inativos para
   * evitar query builder frágil. Definição do RPC em 0003_rpc_inativos.sql.
   */
  async inativosDesde(corteISO: string) {
    const { data, error } = await this.db.rpc("clientes_inativos", { corte: corteISO });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ cliente: { nome: r.nome, telefone: r.telefone } }));
  }

  /**
   * Agendamentos com status "realizado" cuja janela de início cobre o dia
   * ANTERIOR a agoraISO em BRT. Usa import estático de janelaDiaAnterior.
   */
  async realizadosOntem(agoraISO: string) {
    const { de, ate } = janelaDiaAnterior(new Date(agoraISO));
    const { data, error } = await this.db
      .from("agendamentos")
      .select("clientes(nome,telefone)")
      .eq("status", "realizado")
      .gte("inicio", de)
      .lte("inicio", ate);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ cliente: { nome: r.clientes?.nome, telefone: r.clientes?.telefone } }));
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
