# Clínica Cheia — Configuração assistida pelo Claude Code

> Você (Claude Code) está dentro do repositório de um **produto pronto e testado**: um sistema de
> 5 agentes de WhatsApp para clínicas de estética (agendar, confirmar, resgatar falta, lembrar de
> retorno, reativar + pedir avaliação). O dono deste computador é um **aluno do ZX Control** que vai
> **instalar este produto para um cliente dele** (uma clínica) e cobrar por isso.

## 🎯 Seu papel aqui: CONFIGURAR, nunca programar

**Regra de ouro — leia com atenção:**

- A **lógica dos agentes é congelada e validada** (50 testes verdes em `tests/`). Você **NUNCA edita
  arquivos em `src/`**. Não "melhore", não "ajuste", não reescreva agente nenhum.
- Seu trabalho é **só configurar este produto para a clínica do aluno**: coletar as credenciais,
  escrever os arquivos de config, aplicar o banco, fazer o deploy e validar.
- Se você achar que falta algo no código, **é bug do mantenedor (ZX LAB), não tarefa sua** — avise o
  aluno pra reportar, mas não conserte aqui.
- Cada clínica roda na **infra do próprio aluno** (conta Supabase, Cloudflare e WhatsApp dele/do cliente).

Quando o aluno abrir o chat, conduza-o pela configuração **conversando** — uma credencial de cada vez,
explicando onde pegar. No fim, faça o deploy e rode o smoke test. É isso. Nada de código.

---

## Passo a passo da configuração (conduza o aluno, um item de cada vez)

### 1. Boas-vindas e checagem
Diga ao aluno que você vai configurar o "Clínica Cheia" para a clínica dele e que vai pedir algumas
credenciais. Confirme que ele tem (ou crie junto): conta **Supabase**, conta **Cloudflare**, uma chave
**Google Gemini** e uma conexão **WhatsApp** (recomendado: **uazapi**).

### 2. Colete as credenciais (uma de cada vez, com o "onde pegar")
Pergunte e vá anotando. Para cada uma, explique onde encontrar:

| Credencial | Onde o aluno pega |
|---|---|
| `CLINICA_NOME` | Nome da clínica do cliente |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` + `SUPABASE_ANON_KEY` | Supabase → Project Settings → API (a **service key** é secreta; a **anon key** vai pro painel) |
| `GEMINI_API_KEY` | Google AI Studio → Get API key (tem free tier) |
| `WHATSAPP_PROVIDER` + token | Recomende **uazapi**: `UAZAPI_URL` + `UAZAPI_TOKEN` do painel uazapi. (zapi/meta são opções) |
| `GOOGLE_REVIEW_LINK` | Link de avaliação do Google Business da clínica |

Gere você mesmo um **`WEBHOOK_SECRET`** forte (string aleatória) — guarde, vai usar no passo 6.

### 3. Escreva os arquivos de config
Com as respostas, escreva **dois** arquivos (não comite — estão no `.gitignore`):
- `.env` — a partir de `.env.example`, preenchendo todas as chaves coletadas + o `WEBHOOK_SECRET`.
- `painel/config.js` — a partir de `painel/config.example.js`, com `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  (a **anon**, nunca a service) e `CLINICA_NOME`.

> Alternativa: existe um wizard de terminal equivalente (`node setup/configure.mjs`) para quem preferir
> um fluxo scriptado. Mas você pode fazer tudo isso aqui no chat — é o jeito ZX Control.

### 4. Aplique o banco (migrations + seed)
As migrations estão em `supabase/migrations/`. Oriente/rode (precisa do Supabase CLI logado e linkado
ao projeto do cliente):
```bash
supabase link --project-ref <REF_DO_PROJETO>
supabase db push
```
Depois insira os procedimentos default (já vêm do nicho — o wizard gera `supabase/seed.sql`, ou aplique
os `procedimentosDefault` de `src/niche/clinica-estetica.ts`).

### 5. Deploy do Worker e do painel
```bash
CLOUDFLARE_ACCOUNT_ID=<id> pnpm wrangler deploy                          # o motor (agentes)
pnpm wrangler pages deploy painel/ --project-name clinica-cheia-<slug>   # o painel da clínica
```
Configure os secrets do Worker (não vão no .env do Worker — use wrangler secret):
```bash
pnpm wrangler secret put SUPABASE_SERVICE_KEY
pnpm wrangler secret put GEMINI_API_KEY
pnpm wrangler secret put UAZAPI_TOKEN
pnpm wrangler secret put WEBHOOK_SECRET
# (+ as demais vars do .env.example que o Worker usa)
```

### 6. Conecte o WhatsApp
No painel do uazapi (ou provider escolhido), registre o webhook apontando para:
```
<URL_DO_WORKER>/webhook?token=<WEBHOOK_SECRET>
```
O `?token=` é a autenticação — sem ele o Worker rejeita (401). Por isso o secret do passo 2.

### 7. Valide (smoke test) — sempre faça isso
```bash
node setup/smoke.mjs
```
Confirma: variáveis presentes, Supabase responde (cria+apaga registro de teste), WhatsApp envia,
Gemini responde, Worker `/health` 200. **Se algo falhar, pare e mostre o erro ao aluno** — não entregue
quebrado.

### 8. (Opcional) Importar a base atual do cliente
Se a clínica já tem uma planilha de clientes:
```bash
node setup/importar-planilha.mjs caminho.csv
```

---

## Como a clínica opera depois
- **Recepcionista** atende o WhatsApp 24/7 e agenda.
- **Painel** (Cloudflare Pages) é onde a **dona da clínica** vê a agenda do dia e **marca quem veio**
  (Confirmado / Realizado / Faltou). ⚠️ Importante: lembrete de retorno e pedido de avaliação dependem
  de a clínica marcar **Realizado** — ensine isso ao aluno (e ele ensina à clínica).
- Os agentes proativos (confirmar véspera, resgatar falta, lembrar retorno, reativar) rodam sozinhos
  por cron.

## Atualizações do produto
Quando o ZX LAB lançar uma correção, o aluno atualiza por clínica:
```bash
git fetch --tags && git checkout vX.Y.Z
# re-deploy: pnpm wrangler deploy && pnpm wrangler pages deploy painel/ ...
```
Sempre uma **tag** (`vX.Y.Z`), nunca a `main`.
