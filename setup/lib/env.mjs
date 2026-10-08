/**
 * setup/lib/env.mjs — leitura e escrita do .env do wizard, com escape simétrico.
 * Valor com '#', aspas, barra invertida ou espaço nas pontas é gravado entre aspas
 * duplas, com `\` e `"` escapados; a leitura desfaz o escape (ida e volta sem perda).
 */

/** @param {string} valor */
export function formatarValorEnv(valor) {
  const precisaAspas = /[#"\\]/.test(valor) || valor !== valor.trim();
  if (!precisaAspas) return valor;
  return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Lê o conteúdo de um .env para chave→valor.
 * @param {string} conteudo
 * @returns {Record<string, string>}
 */
export function parseEnv(conteudo) {
  const resultado = {};
  for (const linha of conteudo.split("\n")) {
    const crua = linha.trim();
    if (!crua || crua.startsWith("#")) continue;
    const idx = crua.indexOf("=");
    if (idx < 0) continue;
    const chave = crua.slice(0, idx).trim().replace(/^export\s+/, "");
    const resto = crua.slice(idx + 1).trim();
    let valor;
    if (resto.startsWith('"')) {
      // entre aspas duplas: lê até a aspa de fechamento não escapada e desfaz o escape.
      let i = 1;
      let out = "";
      while (i < resto.length && resto[i] !== '"') {
        if (resto[i] === "\\" && (resto[i + 1] === "\\" || resto[i + 1] === '"')) i++;
        out += resto[i++];
      }
      valor = out;
    } else if (resto.startsWith("'")) {
      const fim = resto.indexOf("'", 1);
      valor = fim < 0 ? resto.slice(1) : resto.slice(1, fim);
    } else {
      valor = resto.replace(/\s+#.*$/, "").trim(); // comentário inline só após espaço
    }
    if (chave) resultado[chave] = valor;
  }
  return resultado;
}
