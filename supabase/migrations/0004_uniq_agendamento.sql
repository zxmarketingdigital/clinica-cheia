-- Idempotência: garante que não existam dois agendamentos para o mesmo
-- cliente no mesmo horário de início. Usado como onConflict em criarAgendamento.
create unique index if not exists uniq_agendamento_cliente_inicio
  on agendamentos (cliente_id, inicio);
