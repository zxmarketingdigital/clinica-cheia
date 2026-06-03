-- RPC: clientes_inativos
-- Retorna clientes cujo agendamento mais recente é anterior a `corte`
-- (ou que nunca agendaram). Usado por Agenda.inativosDesde().
create or replace function clientes_inativos(corte timestamptz)
returns table(nome text, telefone text) language sql stable as $$
  select c.nome, c.telefone from clientes c
  left join agendamentos a on a.cliente_id = c.id
  group by c.id, c.nome, c.telefone
  having coalesce(max(a.inicio), 'epoch') < corte;
$$;
