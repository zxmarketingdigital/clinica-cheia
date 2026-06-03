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

-- Defesa em profundidade: anon não pode chamar este RPC.
-- A função já é SECURITY INVOKER (usa RLS do caller), mas este grant
-- adiciona uma camada extra de proteção contra chamadas não autenticadas.
revoke execute on function clientes_inativos(timestamptz) from anon;
grant execute on function clientes_inativos(timestamptz) to authenticated;
