// painel/marca.js — marca do aluno (nome, cores e logo) aplicada em runtime.
//
// Funções PURAS (sem DOM, sem Node) + `aplicarMarca`, que recebe o `document`.
// É usado em dois lugares:
//   - painel/marca-boot.js  → aplica a marca assim que o HTML carrega (antes do supabase-js);
//   - setup/configure.mjs   → valida/normaliza as respostas do wizard (mesma regra nos dois lados).
//
// Sem sistema de temas: só CSS custom properties em :root (--brand, --brand-2, ...).

/** Cor padrão ZX (âmbar) — só entra quando o aluno não informa a dele. */
export const COR_PADRAO = "#D97706";
/** Secundária atual do tema (usada com a cor padrão quando não há secundária). */
export const COR_SECUNDARIA_PADRAO = "#F59E0B";

/** Fundo mais claro das superfícies do painel — referência pra legibilidade de texto colorido. */
const FUNDO_REF = "#222222";

/**
 * Normaliza hex: aceita #RGB ou #RRGGBB (com ou sem '#'), devolve "#RRGGBB" maiúsculo.
 * Qualquer outra coisa → null.
 * @param {unknown} valor
 * @returns {string | null}
 */
export function normalizarHex(valor) {
  if (typeof valor !== "string") return null;
  let h = valor.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return "#" + h.toUpperCase();
}

/** @param {string} hex "#RRGGBB" @returns {[number, number, number]} */
function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** @param {number[]} c @returns {string} */
function paraHex(c) {
  return "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Luminância relativa (WCAG) de "#RRGGBB".
 * @param {string} hex
 */
export function luminancia(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores "#RRGGBB". */
export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Mistura `hex` com `alvo` na proporção `t` (0 = hex, 1 = alvo).
 * @param {string} hex @param {string} alvo @param {number} t
 */
export function misturar(hex, alvo, t) {
  const a = rgb(hex);
  const b = rgb(alvo);
  return paraHex(a.map((v, i) => v + (b[i] - v) * t));
}

/** Versão mais escura da cor (usada como secundária derivada). */
export function escurecer(hex, t = 0.25) {
  return misturar(hex, "#000000", t);
}

/**
 * Cor do texto sobre um fundo/gradiente de marca: preto ou branco, o que der
 * mais contraste no PIOR dos fundos informados.
 * @param {string[]} fundos
 * @returns {"#000000" | "#FFFFFF"}
 */
export function corTextoSobre(...fundos) {
  const pior = (txt) => Math.min(...fundos.map((f) => contraste(txt, f)));
  return pior("#000000") >= pior("#FFFFFF") ? "#000000" : "#FFFFFF";
}

/**
 * Clareia a cor (em direção ao branco) até ela ter contraste legível (>= 4.5)
 * sobre o fundo escuro do painel. Cor que já passa volta intacta.
 * Serve pra texto/ícone colorido — uma marca azul-marinho não some no fundo preto.
 * @param {string} hex @param {string} [fundo]
 */
export function paraTextoNoEscuro(hex, fundo = FUNDO_REF) {
  if (contraste(hex, fundo) >= 4.5) return hex;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = misturar(hex, "#FFFFFF", t);
    if (contraste(c, fundo) >= 4.5) return c;
  }
  return "#FFFFFF";
}

/**
 * Valida o campo `logo`: caminho relativo de imagem (png/jpg/jpeg/svg/webp,
 * sem subpasta nem '..') ou URL https. Devolve o valor limpo ou null.
 * @param {unknown} valor
 * @returns {string | null}
 */
export function validarLogoRef(valor) {
  if (typeof valor !== "string") return null;
  const v = valor.trim();
  if (!v) return null;
  if (/^https:\/\/[^\s"'<>]+$/i.test(v)) return v;
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|svg|webp)$/i.test(v)) return v;
  return null;
}

/**
 * Resolve a marca a partir da config do painel (window.CLINICA_CONFIG).
 * Campos lidos: CLINICA_NOME, COR_PRIMARIA, COR_SECUNDARIA, LOGO.
 * @param {Record<string, unknown>} [cfg]
 */
export function resolverMarca(cfg = {}) {
  const nome = typeof cfg.CLINICA_NOME === "string" ? cfg.CLINICA_NOME.trim() : "";
  const primaria = normalizarHex(cfg.COR_PRIMARIA) ?? COR_PADRAO;
  const secundariaInformada = normalizarHex(cfg.COR_SECUNDARIA);
  const secundaria =
    secundariaInformada ??
    (primaria === COR_PADRAO ? COR_SECUNDARIA_PADRAO : escurecer(primaria));
  const [r, g, b] = rgb(primaria);
  return {
    nome,
    primaria,
    secundaria,
    primariaRgb: `${r} ${g} ${b}`,
    primariaTexto: paraTextoNoEscuro(primaria),
    secundariaTexto: paraTextoNoEscuro(secundaria),
    textoSobreMarca: corTextoSobre(primaria, secundaria),
    logo: validarLogoRef(cfg.LOGO),
  };
}

/**
 * Aplica a marca no documento: CSS vars em :root, nome e logo nos pontos de marca.
 * Seguro de chamar sem config (cai no padrão).
 * @param {Record<string, unknown>} cfg
 * @param {Document} doc
 */
export function aplicarMarca(cfg, doc) {
  const m = resolverMarca(cfg);
  const root = doc.documentElement.style;
  root.setProperty("--brand", m.primaria);
  root.setProperty("--brand-2", m.secundaria);
  root.setProperty("--brand-rgb", m.primariaRgb);
  root.setProperty("--brand-text", m.primariaTexto);
  root.setProperty("--brand-2-text", m.secundariaTexto);
  root.setProperty("--brand-on", m.textoSobreMarca);

  if (m.nome) doc.title = `Painel — ${m.nome}`;

  for (const id of ["brand-login", "brand-header"]) {
    const el = doc.getElementById(id);
    if (!el) continue;
    const textoPadrao = el.textContent;
    if (m.logo) {
      const img = doc.createElement("img");
      img.className = "brand-logo";
      img.alt = m.nome || textoPadrao;
      img.src = m.logo;
      // logo quebrado nunca deixa a marca vazia: volta pro nome em texto.
      img.addEventListener("error", () => {
        el.textContent = m.nome || textoPadrao;
      });
      el.textContent = "";
      el.appendChild(img);
    } else if (m.nome) {
      el.textContent = m.nome;
    }
  }
  return m;
}
