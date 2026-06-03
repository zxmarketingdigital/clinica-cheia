export type StatusAgendamento = "agendado"|"confirmado"|"realizado"|"cancelado"|"faltou";
export interface Cliente { id: string; nome: string; telefone: string; criado_em: string; }
export interface Procedimento { id: string; nome: string; duracao_min: number; cadencia_retorno_dias: number|null; preco_centavos: number|null; }
export interface Agendamento { id: string; cliente_id: string; procedimento_id: string|null; inicio: string; status: StatusAgendamento; confirmado_em: string|null; criado_em: string; }
export interface ItemListaEspera { id: string; cliente_id: string; procedimento_id: string|null; criado_em: string; atendido: boolean; }
