-- Coluna ref para dedup preciso de lembretes (evita ilike com wildcards).
-- Opcional para não quebrar inserts existentes que não passam ref.
alter table mensagens add column if not exists ref text;
