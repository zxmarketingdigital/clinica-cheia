/**
 * setup/lib/marca-setup.mjs
 * Validação das respostas de MARCA do wizard (nome, cor primária, cor secundária, logo).
 *
 * Sem acesso direto a disco: as operações de arquivo entram por `deps`, o que
 * permite testar sem tocar no sistema de arquivos. A regra de cor/logo é a mesma
 * do painel (importada de painel/marca.js) — wizard e painel nunca divergem.
 */

import { normalizarHex, validarLogoRef, COR_PADRAO } from "../../painel/marca.js";

export { COR_PADRAO };

/** Extensões de logo aceitas (copiadas para dentro de painel/). */
export const EXT_LOGO = ["png", "jpg", "jpeg", "svg", "webp"];

export const AVISO_COR_PADRAO =
  "Usando a cor padrão ZX (âmbar). Troque depois em painel/config.js (COR_PRIMARIA).";

/**
 * Limpa o que o terminal cola/arrasta: aspas, espaços nas pontas e barras de escape.
 * @param {string} entrada
 * @param {string} [home]
 */
export function limparCaminho(entrada, home = "") {
  let c = entrada.trim();
  if ((c.startsWith('"') && c.endsWith('"')) || (c.startsWith("'") && c.endsWith("'"))) {
    c = c.slice(1, -1);
  }
  c = c.replace(/\\ /g, " ");
  if (home && (c === "~" || c.startsWith("~/"))) c = home + c.slice(1);
  return c;
}

/** @param {string} entrada @param {{ obrigatoria?: boolean }} [opts] */
export function validarCor(entrada, { obrigatoria = false } = {}) {
  const v = (entrada ?? "").trim();
  if (!v) {
    return obrigatoria
      ? { ok: false, erro: "Informe uma cor em hex, ex: #0F766E (ou #0A7)." }
      : { ok: true, valor: "" };
  }
  const hex = normalizarHex(v);
  if (!hex) return { ok: false, erro: `"${v}" não é uma cor hex válida. Use #RRGGBB ou #RGB, ex: #0F766E.` };
  return { ok: true, valor: hex };
}

/** @param {string} entrada */
export function validarNome(entrada) {
  const v = (entrada ?? "").trim();
  if (!v) return { ok: false, erro: "O nome da clínica é obrigatório." };
  return { ok: true, valor: v.replace(/\s*[\r\n]+\s*/g, " ") };
}

/**
 * @typedef {object} DepsLogo
 * @property {string} painelDir       pasta painel/ de destino
 * @property {string} [home]
 * @property {(caminho: string) => boolean} existe
 * @property {(origem: string, destino: string) => void} copiar
 * @property {(a: string, b: string) => string} juntar   path.join
 * @property {(caminho: string) => string} resolver      path.resolve
 */

/**
 * Valida o logo. Aceita: vazio (sem logo), URL https, nome de arquivo já presente
 * em painel/ (re-execução do wizard) ou caminho local de imagem — que é copiado
 * para painel/logo.<ext>. Devolve o valor que vai para o config do painel.
 * @param {string} entrada
 * @param {DepsLogo} deps
 */
export function validarLogo(entrada, deps) {
  const bruto = (entrada ?? "").trim();
  if (!bruto) return { ok: true, valor: "" };

  if (/^http:\/\//i.test(bruto)) {
    return { ok: false, erro: "URL de logo precisa ser https:// (ou informe o caminho de um arquivo local)." };
  }
  if (/^https:\/\//i.test(bruto)) {
    const ref = validarLogoRef(bruto);
    return ref ? { ok: true, valor: ref } : { ok: false, erro: "URL de logo inválida (sem espaços ou aspas, por favor)." };
  }

  const caminho = limparCaminho(bruto, deps.home);

  // Já é o nome de um arquivo dentro de painel/ (valor gravado numa execução anterior).
  const ref = validarLogoRef(caminho);
  if (ref && !caminho.includes("/") && deps.existe(deps.juntar(deps.painelDir, ref))) {
    return { ok: true, valor: ref };
  }

  const ext = (caminho.split(".").pop() ?? "").toLowerCase();
  if (!EXT_LOGO.includes(ext)) {
    return { ok: false, erro: `Logo precisa ser imagem (${EXT_LOGO.join(", ")}) ou URL https.` };
  }
  const origem = deps.resolver(caminho);
  if (!deps.existe(origem)) {
    return { ok: false, erro: `Arquivo não encontrado: ${origem}` };
  }
  const nomeFinal = `logo.${ext === "jpeg" ? "jpg" : ext}`;
  const destino = deps.juntar(deps.painelDir, nomeFinal);
  if (deps.resolver(destino) !== origem) deps.copiar(origem, destino);
  return { ok: true, valor: nomeFinal };
}
