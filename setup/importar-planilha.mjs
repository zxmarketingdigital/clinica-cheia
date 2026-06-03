/**
 * setup/importar-planilha.mjs
 * CLI para importar clientes a partir de um arquivo CSV para o Supabase.
 *
 * PRINCÍPIO: este script SÓ IMPORTA DADOS, nunca gera ou altera lógica.
 *
 * v1 — importa apenas CLIENTES.
 * Agendamentos históricos ficam fora do escopo v1 (necessitam mapeamento
 * de horário + procedimento que varia por clínica).
 *
 * XLSX: exporte como CSV primeiro (Arquivo > Salvar como > CSV).
 * Não há dependência de biblioteca XLSX no v1.
 *
 * Uso:
 *   node setup/importar-planilha.mjs caminho.csv
 *
 * Requisitos no .env (mesmas vars do .env.example):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { mapearLinhaCliente } from "./lib/mapear.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Carrega .env do diretório atual (sem dependências externas).
 * Suporta comments e valores entre aspas.
 * @returns {Record<string, string>}
 */
function carregarDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return {};
  const linhas = readFileSync(envPath, "utf8").split("\n");
  const resultado = {};
  for (const linha of linhas) {
    const sem = linha.replace(/#[^'"]*$/, "").trim(); // strip inline comment fora de aspas
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
 * Parser CSV simples que respeita aspas duplas básicas.
 * Não suporta newlines dentro de células (suficiente para planilhas de contatos).
 * @param {string} conteudo
 * @returns {Record<string, string>[]}
 */
function parsearCSV(conteudo) {
  const linhas = conteudo.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (linhas.length < 2) return [];

  /** @param {string} linha @returns {string[]} */
  function splitLinha(linha) {
    const celulas = [];
    let atual = "";
    let dentro = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentro && linha[i + 1] === '"') {
          // escaped quote
          atual += '"';
          i++;
        } else {
          dentro = !dentro;
        }
      } else if (c === "," && !dentro) {
        celulas.push(atual);
        atual = "";
      } else {
        atual += c;
      }
    }
    celulas.push(atual);
    return celulas;
  }

  const cabecalho = splitLinha(linhas[0]).map((h) => h.trim());
  const registros = [];
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const celulas = splitLinha(linha);
    /** @type {Record<string, string>} */
    const obj = {};
    cabecalho.forEach((h, idx) => {
      obj[h] = celulas[idx] !== undefined ? celulas[idx].trim() : "";
    });
    registros.push(obj);
  }
  return registros;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Uso: node setup/importar-planilha.mjs caminho.csv");
    process.exit(1);
  }

  const caminhoCSV = resolve(args[0]);
  if (!existsSync(caminhoCSV)) {
    console.error(`Arquivo não encontrado: ${caminhoCSV}`);
    process.exit(1);
  }

  // Carregar .env
  const env = { ...carregarDotEnv(), ...process.env };
  const SUPABASE_URL = env["SUPABASE_URL"];
  const SUPABASE_SERVICE_KEY = env["SUPABASE_SERVICE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "❌  SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios no .env"
    );
    process.exit(1);
  }

  // Ler CSV
  let conteudo;
  try {
    conteudo = readFileSync(caminhoCSV, "utf8");
  } catch (e) {
    console.error(`Erro ao ler arquivo: ${e.message}`);
    process.exit(1);
  }

  const linhas = parsearCSV(conteudo);
  if (linhas.length === 0) {
    console.error("Arquivo CSV vazio ou sem linhas de dados.");
    process.exit(1);
  }
  console.log(`\n📋  ${linhas.length} linha(s) encontrada(s) no CSV.`);

  // Mapear clientes
  const clientes = [];
  let pulados = 0;
  for (let i = 0; i < linhas.length; i++) {
    const mapeado = mapearLinhaCliente(linhas[i]);
    if (!mapeado) {
      console.warn(`  ⚠️   Linha ${i + 2} pulada (nome ou telefone ausente/inválido): ${JSON.stringify(linhas[i])}`);
      pulados++;
    } else {
      clientes.push(mapeado);
    }
  }
  console.log(`  ✅  ${clientes.length} cliente(s) mapeados, ${pulados} pulado(s).\n`);

  if (clientes.length === 0) {
    console.error("Nenhum cliente válido para importar.");
    process.exit(1);
  }

  // Conectar ao Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Upsert em lotes de 100 (evita payload grande)
  const LOTE = 100;
  let importados = 0;
  let erros = 0;
  for (let i = 0; i < clientes.length; i += LOTE) {
    const lote = clientes.slice(i, i + LOTE);
    const { error } = await supabase
      .from("clientes")
      .upsert(lote, { onConflict: "telefone" });
    if (error) {
      console.error(`  ❌  Erro no lote ${Math.floor(i / LOTE) + 1}: ${error.message}`);
      erros += lote.length;
    } else {
      importados += lote.length;
      process.stdout.write(`  ✅  Lote ${Math.floor(i / LOTE) + 1}: ${lote.length} upserted.\n`);
    }
  }

  console.log(`\n📊  Resumo:`);
  console.log(`  Importados/atualizados : ${importados}`);
  console.log(`  Pulados (inválidos)    : ${pulados}`);
  console.log(`  Erros Supabase         : ${erros}`);

  if (erros > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Erro inesperado:", e);
  process.exit(1);
});
