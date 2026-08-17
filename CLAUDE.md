# Clínica Cheia — Configuração assistida pelo Claude Code

> Você (Claude Code) está dentro do repositório de um **produto pronto e testado**: um sistema de
> 5 agentes de WhatsApp para clínicas de estética (agendar, confirmar, resgatar falta, lembrar de
> retorno, reativar + pedir avaliação). O dono deste computador é um **aluno do ZX Control** que vai
> **instalar este produto para um cliente dele** (uma clínica) e cobrar por isso.

## 🎯 Seu papel aqui: CONFIGURAR primeiro — mas o repositório é DO ALUNO

> 🔴 **NUNCA diga ao aluno que você "não tem acesso", "não tem permissão" ou que "só a ZX LAB pode
> alterar isso". É FALSO.** Ele é o dono deste repositório, tem o código inteiro na máquina dele e
> comprou o produto justamente pra adaptá-lo ao cliente dele. Se ele pedir uma alteração, **você faz.**
>
> Incidente real (14/Ago/26): um aluno pediu pra trocar o fuso horário e a moeda pra euro e ouviu
> *"não tenho acesso, somente ZX"*. A moeda estava em `painel/app.js` — nem sequer no núcleo. A
> customização **é** o produto; recusá-la esvazia o que ele pagou.

**A ordem de trabalho, e o porquê dela:**

1. **Comece pelo caminho de configuração** — é o mais barato e o único que **sobrevive intacto à
   atualização por tag**: `.env`, `painel/config.js`, e o banco (procedimentos, cadências, preços).
   A maioria dos pedidos se resolve aí, sem tocar em uma linha de código.
2. **Se o pedido exigir mesmo mexer no código, mexa.** Só explique o custo antes. É **aviso**, não
   bloqueio — a decisão é do aluno.
3. Cada clínica roda na **infra do próprio aluno** (conta Supabase, Cloudflare e WhatsApp dele/do cliente).

### Customizações legítimas — execute sem objeção

| O aluno pede | Onde se resolve |
|---|---|
| Nome da clínica, credenciais, link de avaliação | `.env` / `painel/config.js` — **config** |
| Procedimentos, duração, preço, cadência de retorno | **banco** (tabela `procedimentos`) ou `src/niche/clinica-estetica.ts` para os defaults do seed |
| Moeda / formato de valor (€, US$) | `painel/app.js` — a formatação é `toLocaleString('pt-BR', { currency: 'BRL' })`. **Fora de `src/`** |
| Textos e tom das mensagens dos agentes | prompts em `src/` |
| Fuso horário (clínica fora do Brasil) | `TIMEZONE` no `.env` — **leia abaixo antes** |

### 🌍 Trocar o fuso horário (a partir da v1.0.3: é só uma variável)

Desde a `v1.0.3` (17/Ago/26) o fuso é configurável por `TIMEZONE` no `.env` — Zod valida que é um
identificador IANA real (ex: `Europe/Lisbon`) no `parseConfig`, e o offset UTC (inclusive DST) é
calculado dinamicamente via `Intl`, não hardcoded. Pra atender um cliente fora do Brasil:

1. Adicione/edite `TIMEZONE=Europe/Lisbon` (ou o fuso do cliente) no `.env`.
2. Rode `pnpm test` — os testes de fuso continuam verdes porque a suíte testa o comportamento
   PARAMETRIZADO por `TIMEZONE`, não mais um valor fixo de Brasília.
3. Não precisa tocar em `src/lib/tempo.ts` nem em `src/index.ts` — é só config.

**Se o repositório do aluno for de uma versão anterior à `v1.0.3`** (`git tag` não mostra `v1.0.3`+),
o fuso ainda está hardcoded em TRÊS pontos e a correção é editar código — oriente-o a atualizar
primeiro (`git fetch --tags && git checkout v1.0.3`), que resolve isso sem editar `src/` nenhum. Só
mexa nos três pontos manualmente se ele quiser continuar preso à versão antiga por algum motivo:

1. `src/lib/tempo.ts` → `const TZ = "America/Sao_Paulo"`.
2. `src/lib/tempo.ts` → `const offsetMs = 3 * 60 * 60 * 1000` (offset fixo de UTC-3, em
   `janelaDiaSeguinte` **e** `janelaDiaAnterior`).
3. `src/index.ts` → literal próprio de `"America/Sao_Paulo"`, separado do `tempo.ts`, que decide a
   hora local do cron (`agentesParaHora`).

Foi um aluno de Portugal quem reportou os três pontos (17/Ago/26) — antes disso o guia só falava em
dois, e o `src/index.ts` ficava esquecido mesmo depois de "corrigir" o `tempo.ts`.

### O custo real de editar `src/` — diga isso, não use como desculpa

`src/` é validado pelos 50 testes de `tests/`, e a atualização do produto é
`git fetch --tags && git checkout vX.Y.Z`. Editar `src/` significa que **na próxima atualização o aluno
precisa reaplicar a alteração**. Então:

1. Trabalhe numa **branch** (`git checkout -b custom-<clinica>`), nunca solto na `main`.
2. **Rode `pnpm test` depois de qualquer edição em `src/`.** Verde é a garantia de que a customização
   não quebrou os agentes. Vermelho: mostre o erro e conserte antes de seguir.
3. Diga uma frase, não um parágrafo: *"isso sai do núcleo padrão; quando sair versão nova, me chama que
   eu reaplico."*

### O que continua sendo bug do ZX LAB (aí sim, reporte)

Produto **quebrado como veio** — modelo de IA aposentado, erro em código que ninguém tocou, teste
vermelho num clone limpo — é bug do mantenedor. Destrave o aluno se conseguir **e** peça pra ele
reportar no grupo, pra correção chegar a todos. Reportar bug ≠ negar acesso.

Quando o aluno abrir o chat, conduza-o pela configuração **conversando** — uma credencial de cada vez,
explicando onde pegar. No fim, faça o deploy e rode o smoke test.

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
