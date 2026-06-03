-- 0002_rls.sql
-- Habilita RLS em todas as tabelas e libera acesso total para usuários autenticados.
-- O painel da clínica (single-tenant) autentica via Supabase Auth (email/senha);
-- a policy "for all" cobre SELECT, INSERT, UPDATE e DELETE.

alter table clientes enable row level security;
create policy "auth full clientes" on clientes
  for all to authenticated using (true) with check (true);

alter table agendamentos enable row level security;
create policy "auth full agendamentos" on agendamentos
  for all to authenticated using (true) with check (true);

alter table procedimentos enable row level security;
create policy "auth full procedimentos" on procedimentos
  for all to authenticated using (true) with check (true);

alter table lista_espera enable row level security;
create policy "auth full lista_espera" on lista_espera
  for all to authenticated using (true) with check (true);

alter table mensagens enable row level security;
create policy "auth full mensagens" on mensagens
  for all to authenticated using (true) with check (true);
