-- 0001_init.sql
create table procedimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  duracao_min int not null default 60,
  cadencia_retorno_dias int,            -- null = não tem retorno previsto
  preco_centavos int
);
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique,        -- E.164
  criado_em timestamptz not null default now()
);
create table agendamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  procedimento_id uuid references procedimentos(id),
  inicio timestamptz not null,
  status text not null default 'agendado'
    check (status in ('agendado','confirmado','realizado','cancelado','faltou')),
  confirmado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on agendamentos (inicio);
create index on agendamentos (status);
create table lista_espera (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  procedimento_id uuid references procedimentos(id),
  criado_em timestamptz not null default now(),
  atendido boolean not null default false
);
create table mensagens (
  id uuid primary key default gen_random_uuid(),
  telefone text not null,
  direcao text not null check (direcao in ('in','out')),
  corpo text not null,
  agente text,                          -- qual agente enviou
  criado_em timestamptz not null default now()
);
