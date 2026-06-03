/**
 * setup/smoke.mjs
 * Validação pós-instalação. Sai com código 1 se qualquer check crítico falhar.
 *
 * PRINCÍPIO: este script SÓ VALIDA, nunca gera ou altera lógica.
 *
 * Uso:
 *   node setup/smoke.mjs
 *
 * Variáveis opcionais:
 *   SMOKE_TEST_PHONE  — número (E.164 com DDI) para testar envio de WhatsApp.
 *                       Se ausente, o check de WhatsApp é pulado (sem falha).
 *   WORKER_URL        — URL do Worker deployado. Se ausente, check /health é pulado.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Carrega .env do CWD sem dependências externas. */
function carregarDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return {};
  const linhas = readFileSync(envPath, "utf8").split("\n");
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

const OK = "✅";
const FAIL = "❌";
const SKIP = "⚠️ ";

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Check 1 — Variáveis obrigatórias presentes.
 * @param {Record<string, string>} env
 * @returns {{ passou: boolean; msg: string }}
 */
function checkVars(env) {
  const obrigatorias = [
    "CLINICA_NOME",
    "WHATSAPP_PROVIDER",
    "UAZAPI_URL",
    "UAZAPI_TOKEN",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_REVIEW_LINK",
  ];
  const faltando = obrigatorias.filter((k) => !env[k]);
  if (faltando.length > 0) {
    return { passou: false, msg: `Variáveis ausentes: ${faltando.join(", ")}` };
  }
  return { passou: true, msg: "Todas as variáveis obrigatórias presentes." };
}

/**
 * Check 2 — Supabase: insert, read, delete de registro de teste.
 * @param {string} url
 * @param {string} serviceKey
 * @returns {Promise<{ passou: boolean; msg: string }>}
 */
async function checkSupabase(url, serviceKey) {
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const testPhone = "5500000000000";
  try {
    // Insert
    const { error: insErr } = await supabase
      .from("clientes")
      .upsert({ nome: "Smoke Test", telefone: testPhone }, { onConflict: "telefone" });
    if (insErr) return { passou: false, msg: `Upsert falhou: ${insErr.message}` };

    // Read
    const { data, error: selErr } = await supabase
      .from("clientes")
      .select("telefone")
      .eq("telefone", testPhone)
      .single();
    if (selErr || !data) return { passou: false, msg: `Select falhou: ${selErr?.message}` };

    // Delete
    const { error: delErr } = await supabase
      .from("clientes")
      .delete()
      .eq("telefone", testPhone);
    if (delErr) return { passou: false, msg: `Delete falhou: ${delErr.message}` };

    return { passou: true, msg: "Supabase: insert + read + delete OK." };
  } catch (e) {
    return { passou: false, msg: `Exceção: ${e.message}` };
  }
}

/**
 * Check 3 — WhatsApp via uazapi: envia mensagem de teste para SMOKE_TEST_PHONE.
 * Pulado se SMOKE_TEST_PHONE ausente.
 * @param {Record<string, string>} env
 * @returns {Promise<{ passou: boolean; pulado: boolean; msg: string }>}
 */
async function checkWhatsApp(env) {
  const phone = env["SMOKE_TEST_PHONE"];
  if (!phone) {
    return { passou: true, pulado: true, msg: "SMOKE_TEST_PHONE não definido — check pulado." };
  }

  const provider = (env["WHATSAPP_PROVIDER"] || "uazapi").toLowerCase();
  if (provider !== "uazapi") {
    return { passou: true, pulado: true, msg: `Provider '${provider}' não suportado no smoke v1 — check pulado.` };
  }

  const url = env["UAZAPI_URL"];
  const token = env["UAZAPI_TOKEN"];
  const body = JSON.stringify({
    phone,
    message: "🔧 Smoke test Clínica Cheia — pode ignorar esta mensagem.",
  });

  try {
    const res = await fetch(`${url}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { passou: false, pulado: false, msg: `uazapi retornou ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { passou: true, pulado: false, msg: `Mensagem de teste enviada para ${phone}.` };
  } catch (e) {
    return { passou: false, pulado: false, msg: `Erro ao chamar uazapi: ${e.message}` };
  }
}

/**
 * Check 4 — Gemini: chamada trivial com GEMINI_API_KEY.
 * @param {string} apiKey
 * @returns {Promise<{ passou: boolean; msg: string }>}
 */
async function checkGemini(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: "Responda apenas a palavra: ok" }] }],
    generationConfig: { maxOutputTokens: 5 },
  });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const txt = await res.text().catch(() => "");
      return { passou: false, msg: `Gemini auth/config error ${res.status}: ${txt.slice(0, 200)}` };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { passou: false, msg: `Gemini retornou ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { passou: true, msg: "Gemini API: autenticação e resposta OK." };
  } catch (e) {
    return { passou: false, msg: `Erro ao chamar Gemini: ${e.message}` };
  }
}

/**
 * Check 5 — Worker /health: GET e espera 200.
 * Pulado se WORKER_URL ausente.
 * @param {string | undefined} workerUrl
 * @returns {Promise<{ passou: boolean; pulado: boolean; msg: string }>}
 */
async function checkWorker(workerUrl) {
  if (!workerUrl) {
    return { passou: true, pulado: true, msg: "WORKER_URL não definido — check pulado." };
  }
  const healthUrl = workerUrl.replace(/\/$/, "") + "/health";
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
    if (res.status !== 200) {
      return { passou: false, pulado: false, msg: `Worker /health retornou ${res.status} (esperado 200).` };
    }
    return { passou: true, pulado: false, msg: `Worker /health OK (200).` };
  } catch (e) {
    return { passou: false, pulado: false, msg: `Erro ao chamar Worker: ${e.message}` };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const env = { ...carregarDotEnv(), ...process.env };
  const clinica = env["CLINICA_NOME"] || "(sem nome)";

  console.log(`\n🔍  Smoke test — ${clinica}`);
  console.log("=".repeat(50));

  let falhou = false;

  // 1. Variáveis
  {
    const r = checkVars(env);
    console.log(`${r.passou ? OK : FAIL}  [1/5] Variáveis: ${r.msg}`);
    if (!r.passou) falhou = true;
  }

  // 2. Supabase
  if (env["SUPABASE_URL"] && env["SUPABASE_SERVICE_KEY"]) {
    const r = await checkSupabase(env["SUPABASE_URL"], env["SUPABASE_SERVICE_KEY"]);
    console.log(`${r.passou ? OK : FAIL}  [2/5] Supabase: ${r.msg}`);
    if (!r.passou) falhou = true;
  } else {
    console.log(`${FAIL}  [2/5] Supabase: credenciais ausentes — pulando conectividade.`);
    falhou = true;
  }

  // 3. WhatsApp
  {
    const r = await checkWhatsApp(env);
    const icon = r.pulado ? SKIP : r.passou ? OK : FAIL;
    console.log(`${icon}  [3/5] WhatsApp: ${r.msg}`);
    if (!r.passou && !r.pulado) falhou = true;
  }

  // 4. Gemini
  if (env["GEMINI_API_KEY"]) {
    const r = await checkGemini(env["GEMINI_API_KEY"]);
    console.log(`${r.passou ? OK : FAIL}  [4/5] Gemini: ${r.msg}`);
    if (!r.passou) falhou = true;
  } else {
    console.log(`${FAIL}  [4/5] Gemini: GEMINI_API_KEY ausente.`);
    falhou = true;
  }

  // 5. Worker /health
  {
    const r = await checkWorker(env["WORKER_URL"]);
    const icon = r.pulado ? SKIP : r.passou ? OK : FAIL;
    console.log(`${icon}  [5/5] Worker: ${r.msg}`);
    if (!r.passou && !r.pulado) falhou = true;
  }

  console.log("=".repeat(50));
  if (falhou) {
    console.log(`\n${FAIL}  Smoke falhou. Corrija os erros acima e rode novamente.\n`);
    process.exit(1);
  } else {
    console.log(`\n${OK}  Tudo OK! Instalação validada com sucesso.\n`);
  }
}

main().catch((e) => {
  console.error("Erro inesperado no smoke:", e);
  process.exit(1);
});
