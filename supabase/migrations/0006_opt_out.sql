-- 0006_opt_out.sql
-- Opt-out de mensagens proativas (LGPD). Cliente responde "SAIR" e para de receber
-- confirmações, resgates, lembretes e reativações. Tabela própria (keyed por telefone)
-- pra registrar consentimento mesmo de quem nunca virou cliente/agendou.
create table opt_outs (
  telefone text primary key,            -- E.164
  criado_em timestamptz not null default now()
);

alter table opt_outs enable row level security;
create policy "auth full opt_outs" on opt_outs
  for all to authenticated using (true) with check (true);
