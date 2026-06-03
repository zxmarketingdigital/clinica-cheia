import type { Agendamento, Cliente } from "./types";

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

  async logMensagem(
    telefone: string,
    direcao: "in" | "out",
    corpo: string,
    agente?: string
  ) {
    await this.db.from("mensagens").insert({ telefone, direcao, corpo, agente });
  }
}
