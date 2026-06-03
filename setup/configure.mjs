/**
 * setup/configure.mjs
 * Wizard interativo de instalação do Clínica Cheia.
 *
 * PRINCÍPIO CENTRAL: este wizard SÓ CONFIGURA, NUNCA GERA LÓGICA.
 * Ele preenche credenciais (.env e painel/config.js) e orienta o aluno
 * nos próximos passos manuais (migrations, deploy, webhook).
 * Nenhum código de agente é criado ou alterado aqui.
 *
 * É IDEMPOTENTE: re-rodar mostra os valores atuais e permite
 * pressionar Enter para mantê-los, sem destruir config existente.
 *
 * Uso:
 *   node setup/configure.mjs
 */

import { createInterface } from "readline/promises";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers .env
// ---------------------------------------------------------------------------

/**
 * Carrega .env existente para um objeto chave→valor.
 * @param {string} path
 * @returns {Record<string, string>}
 */
function lerEnv(path) {
  if (!existsSync(path)) return {};
  const linhas = readFileSync(path, "utf8").split("\n");
  const resultado = {};
  for (const linha of linhas) {
    const sem = linha.replace(/#[^'"]*$/, "").trim();
    if (!sem || !sem.includes("=")) continue;
    const idx = sem.indexOf("=");
    const chave = sem.slice(0, idx).trim().replace(/^export\s+/, "");
    let valor = sem.slice(idx + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (chave) resultado[chave] = valor;
  }
  return resultado;
}

/**
 * Serializa um objeto de config para formato .env.
 * @param {Record<string, string>} config
 * @param {Array<{key: string; comment?: string}>} ordem
 * @returns {string}
 */
function serializarEnv(config, ordem) {
  const linhas = ["# Gerado por setup/configure.mjs — NÃO commitar este arquivo.", ""];
  for (const { key, comment } of ordem) {
    if (comment) linhas.push(`# ${comment}`);
    const valor = config[key] ?? "";
    linhas.push(`${key}=${valor}`);
  }
  linhas.push("");
  return linhas.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers painel/config.js
// ---------------------------------------------------------------------------

/**
 * Gera o conteúdo de painel/config.js a partir do template exemplo.
 * @param {string} supabaseUrl
 * @param {string} supabaseAnonKey
 * @param {string} clinicaNome
 * @returns {string}
 */
function gerarConfigPainel(supabaseUrl, supabaseAnonKey, clinicaNome) {
  return `// Gerado por setup/configure.mjs — NÃO commitar este arquivo.
// Contém credenciais públicas (anon key) do projeto Supabase da clínica.
window.CLINICA_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(supabaseUrl)},
  SUPABASE_ANON_KEY: ${JSON.stringify(supabaseAnonKey)},
  CLINICA_NOME: ${JSON.stringify(clinicaNome)},
};
`;
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

/** @typedef {{ key: string; label: string; hint: string; comment?: string }} Campo */

/** @type {Campo[]} */
const CAMPOS_ENV = [
  {
    key: "CLINICA_NOME",
    label: "Nome da clínica",
    hint: "Ex: Clínica Bella — aparece nas mensagens e no painel.",
  },
  {
    key: "SUPABASE_URL",
    label: "Supabase URL",
    hint: "No dashboard Supabase → Settings → API → Project URL. Ex: https://xyzcompany.supabase.co",
  },
  {
    key: "SUPABASE_SERVICE_KEY",
    label: "Supabase Service Role Key",
    hint: "No dashboard Supabase → Settings → API → service_role (secreta). Usada só no Worker (servidor).",
    comment: "Service Role Key — NUNCA expor no frontend",
  },
  {
    key: "SUPABASE_ANON_KEY",
    label: "Supabase Anon (public) Key",
    hint: "No dashboard Supabase → Settings → API → anon / public. Usada no painel (frontend).",
    comment: "Anon Key — usada no painel (frontend)",
  },
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API Key",
    hint: "Em https://aistudio.google.com/app/apikey → Create API Key.",
    comment: "Gemini Flash — cérebro dos agentes",
  },
  {
    key: "WHATSAPP_PROVIDER",
    label: "Provider WhatsApp",
    hint: "Opções: uazapi (recomendado) | zapi | meta. Padrão: uazapi",
    comment: "uazapi | zapi | meta",
  },
  {
    key: "UAZAPI_URL",
    label: "uazapi URL",
    hint: "No painel uazapi → Instâncias → sua instância → URL base. Ex: https://app.uazapi.com/instance/abc123",
  },
  {
    key: "UAZAPI_TOKEN",
    label: "uazapi Token",
    hint: "No painel uazapi → Instâncias → sua instância → Token de acesso.",
    comment: "Token de acesso da instância uazapi",
  },
  {
    key: "GOOGLE_REVIEW_LINK",
    label: "Link de avaliação Google",
    hint: "No Google Business → Clientes → Avaliações → Compartilhar link. Ex: https://g.page/r/xxx/review",
    comment: "Link encurtado do Google Business para pedido de avaliação",
  },
];

/** Campos que vão para o .env mas não para painel/config.js */
const ENV_APENAS = new Set([
  "SUPABASE_SERVICE_KEY",
  "GEMINI_API_KEY",
  "UAZAPI_URL",
  "UAZAPI_TOKEN",
  "WHATSAPP_PROVIDER",
  "GOOGLE_REVIEW_LINK",
]);

/**
 * Pergunta ao usuário um valor. Se já houver valor atual, mostra como padrão.
 * @param {import("readline/promises").Interface} rl
 * @param {Campo} campo
 * @param {string | undefined} valorAtual
 * @returns {Promise<string>}
 */
async function perguntar(rl, campo, valorAtual) {
  const padrao = valorAtual ? ` [atual: ${valorAtual.length > 60 ? valorAtual.slice(0, 57) + "..." : valorAtual}]` : "";
  const resposta = await rl.question(`  ${campo.label}${padrao}\n  (${campo.hint})\n  > `);
  const limpa = resposta.trim();
  if (limpa === "" && valorAtual) return valorAtual;
  return limpa;
}

// ---------------------------------------------------------------------------
// Seed SQL de procedimentos
// ---------------------------------------------------------------------------

/**
 * Gera um arquivo supabase/seed.sql com os procedimentosDefault do niche.
 * NOTA: este arquivo é para referência — o aluno pode aplica-lo manualmente
 * com `psql` ou pelo dashboard SQL Editor do Supabase.
 */
async function gerarSeedSQL() {
  // Import dinâmico do niche (TypeScript já compilado ou via import direto do .ts não é possível em Node)
  // Lemos o arquivo TS e extraímos os procedimentos via regex simples — sem compilador.
  const nichePath = resolve(ROOT, "src", "niche", "clinica-estetica.ts");
  if (!existsSync(nichePath)) return null;

  const conteudo = readFileSync(nichePath, "utf8");
  // Extrai o array procedimentosDefault como texto
  const match = conteudo.match(/procedimentosDefault:\s*\[([^\]]+)\]/s);
  if (!match) return null;

  // Parse básico: extrai objetos { nome: "...", duracao_min: N, cadencia_retorno_dias: N|null, preco_centavos: N|null }
  const blocos = match[1].match(/\{[^}]+\}/g) || [];
  const inserts = [];

  for (const bloco of blocos) {
    const nome = bloco.match(/nome:\s*"([^"]+)"/)?.[1];
    const duracao = bloco.match(/duracao_min:\s*(\d+)/)?.[1] ?? "60";
    const cadencia = bloco.match(/cadencia_retorno_dias:\s*(\d+)/)?.[1] ?? null;
    const preco = bloco.match(/preco_centavos:\s*(\d+)/)?.[1] ?? null;

    if (!nome) continue;

    const cadenciaSQL = cadencia ? cadencia : "NULL";
    const precoSQL = preco ? preco : "NULL";

    inserts.push(
      `  ('${nome.replace(/'/g, "''")}', ${duracao}, ${cadenciaSQL}, ${precoSQL})`
    );
  }

  if (inserts.length === 0) return null;

  const sql = `-- seed.sql — gerado por setup/configure.mjs
-- Procedimentos padrão para clínica de estética.
-- Aplicar via: Dashboard Supabase → SQL Editor → Run
--          ou: psql "$DATABASE_URL" -f supabase/seed.sql

insert into procedimentos (nome, duracao_min, cadencia_retorno_dias, preco_centavos)
values
${inserts.join(",\n")}
on conflict do nothing;
`;

  const seedDir = resolve(ROOT, "supabase");
  if (!existsSync(seedDir)) mkdirSync(seedDir, { recursive: true });
  const seedPath = resolve(seedDir, "seed.sql");
  writeFileSync(seedPath, sql, "utf8");
  return seedPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const envPath = resolve(ROOT, ".env");
  const painelConfigPath = resolve(ROOT, "painel", "config.js");

  console.log("\n🏥  Wizard de instalação — Clínica Cheia");
  console.log("=".repeat(50));
  console.log("Este wizard configura credenciais e orienta os próximos passos.");
  console.log("Pressione Enter para manter o valor atual de cada campo.\n");

  const atual = lerEnv(envPath);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  /** @type {Record<string, string>} */
  const config = {};

  for (const campo of CAMPOS_ENV) {
    config[campo.key] = await perguntar(rl, campo, atual[campo.key]);
    console.log();
  }

  rl.close();

  // Gravar .env
  const ordemEnv = CAMPOS_ENV
    .filter((c) => c.key !== "SUPABASE_ANON_KEY") // anon key vai só pro painel
    .concat([
      // extras que podem estar no .env mas não são perguntados no wizard
    ]);

  // Inclui SUPABASE_ANON_KEY no .env também (útil para scripts locais)
  const ordemFinal = CAMPOS_ENV.map((c) => ({ key: c.key, comment: c.comment }));
  // Adiciona extras que podem existir no .env original mas não são perguntados
  for (const key of Object.keys(atual)) {
    if (!ordemFinal.some((o) => o.key === key)) {
      ordemFinal.push({ key, comment: undefined });
      config[key] = atual[key]; // preserva
    }
  }

  writeFileSync(envPath, serializarEnv(config, ordemFinal), "utf8");
  console.log(`✅  .env gravado em ${envPath}`);

  // Gravar painel/config.js
  const painelDir = resolve(ROOT, "painel");
  if (!existsSync(painelDir)) mkdirSync(painelDir, { recursive: true });
  const painelContent = gerarConfigPainel(
    config["SUPABASE_URL"] ?? "",
    config["SUPABASE_ANON_KEY"] ?? "",
    config["CLINICA_NOME"] ?? ""
  );
  writeFileSync(painelConfigPath, painelContent, "utf8");
  console.log(`✅  painel/config.js gravado em ${painelConfigPath}`);

  // Gerar seed.sql
  const seedPath = await gerarSeedSQL();
  if (seedPath) {
    console.log(`✅  supabase/seed.sql gerado em ${seedPath}`);
  }

  // ---------------------------------------------------------------------------
  // Próximos passos manuais
  // ---------------------------------------------------------------------------
  const slug = (config["CLINICA_NOME"] ?? "clinica")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  console.log(`
${"=".repeat(50)}
📋  PRÓXIMOS PASSOS MANUAIS
${"=".repeat(50)}

O wizard finalizou a configuração de credenciais.
Os passos abaixo NÃO são executados automaticamente (v1)
para evitar estado parcial em caso de erro.

─────────────────────────────────────────────────
1. APLICAR MIGRATIONS (Supabase)
─────────────────────────────────────────────────
  Requer: Supabase CLI instalado e projeto linkado.

  # Logar no Supabase CLI (uma vez por máquina):
  supabase login

  # Linkar ao projeto (pegue o ref no dashboard → Settings → General):
  supabase link --project-ref <SEU_PROJECT_REF>

  # Aplicar todas as migrations de supabase/migrations/:
  supabase db push

─────────────────────────────────────────────────
2. SEED DE PROCEDIMENTOS (opcional, recomendado)
─────────────────────────────────────────────────
${seedPath
  ? `  Um arquivo supabase/seed.sql foi gerado com os procedimentos
  padrão de estética. Para aplicar:

  # Via Supabase CLI:
  supabase db execute --file supabase/seed.sql

  # Ou abra o arquivo no SQL Editor do dashboard Supabase e clique Run.`
  : `  Insira os procedimentos manualmente via SQL Editor do dashboard Supabase
  ou via psql. Veja src/niche/clinica-estetica.ts para os valores padrão.`}

─────────────────────────────────────────────────
3. DEPLOY DO WORKER (Cloudflare)
─────────────────────────────────────────────────
  Requer: CLOUDFLARE_ACCOUNT_ID no ambiente e wrangler autenticado.

  # Autenticar (uma vez por máquina):
  pnpm wrangler login

  # Deploy:
  CLOUDFLARE_ACCOUNT_ID=<SEU_ACCOUNT_ID> pnpm wrangler deploy

  # Anote a URL do Worker exibida no final (ex: https://clinica-cheia.<seu-subdominio>.workers.dev).
  # Adicione-a ao .env como WORKER_URL=<url> para o smoke test.

─────────────────────────────────────────────────
4. DEPLOY DO PAINEL (Cloudflare Pages)
─────────────────────────────────────────────────
  CLOUDFLARE_ACCOUNT_ID=<SEU_ACCOUNT_ID> \\
    pnpm wrangler pages deploy painel/ \\
    --project-name clinica-cheia-${slug} \\
    --branch main

─────────────────────────────────────────────────
5. REGISTRAR WEBHOOK DO WHATSAPP
─────────────────────────────────────────────────
  No painel da sua instância uazapi, configure o webhook apontando para:

    <WORKER_URL>/webhook

  Exemplo: https://clinica-cheia.seu-subdominio.workers.dev/webhook

  Ative os eventos: message.received (ou equivalente na sua versão uazapi).

─────────────────────────────────────────────────
6. VALIDAR A INSTALAÇÃO (smoke test)
─────────────────────────────────────────────────
  node setup/smoke.mjs

  Se tudo estiver ✅, a instalação está completa!
  Para testar o envio WhatsApp, adicione ao .env:
    SMOKE_TEST_PHONE=55DDD9XXXXXXXX

${"=".repeat(50)}
`);
}

main().catch((e) => {
  console.error("Erro inesperado no wizard:", e);
  process.exit(1);
});
