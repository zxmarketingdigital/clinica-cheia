import { describe, it, expect } from "vitest";
// @ts-ignore - js sem tipos
import * as marca from "../painel/marca.js";
// @ts-ignore - mjs sem tipos
import * as setupMarca from "../setup/lib/marca-setup.mjs";

const { normalizarHex, contraste, corTextoSobre, paraTextoNoEscuro, escurecer, validarLogoRef,
  resolverMarca, aplicarMarca, COR_PADRAO, COR_SECUNDARIA_PADRAO } = marca as any;
const { validarCor, validarNome, validarLogo, limparCaminho } = setupMarca as any;

describe("normalizarHex", () => {
  it("normaliza #RGB e #RRGGBB para #RRGGBB maiúsculo", () => {
    expect(normalizarHex("#0a7")).toBe("#00AA77");
    expect(normalizarHex("0f766e")).toBe("#0F766E");
    expect(normalizarHex("  #D97706 ")).toBe("#D97706");
  });
  it("rejeita o resto", () => {
    for (const ruim of ["", "#12", "#12345", "#1234567", "azul", "rgb(1,2,3)", "#GGGGGG", null, undefined, 123]) {
      expect(normalizarHex(ruim)).toBeNull();
    }
  });
});

describe("contraste e legibilidade", () => {
  it("texto sobre o âmbar padrão continua preto (como era)", () => {
    expect(corTextoSobre(COR_PADRAO, COR_SECUNDARIA_PADRAO)).toBe("#000000");
  });
  it("cor escura leva texto branco, cor clara leva texto escuro", () => {
    expect(corTextoSobre("#1E3A8A")).toBe("#FFFFFF");
    expect(corTextoSobre("#FDE68A")).toBe("#000000");
    expect(corTextoSobre("#FFFFFF")).toBe("#000000");
    expect(corTextoSobre("#000000")).toBe("#FFFFFF");
  });
  it("o pior fundo do gradiente decide a cor do texto", () => {
    const a = "#FFD84D";
    const b = "#1E3A8A";
    const txt = corTextoSobre(a, b);
    const pior = (t: string) => Math.min(contraste(t, a), contraste(t, b));
    const outro = txt === "#000000" ? "#FFFFFF" : "#000000";
    expect(pior(txt)).toBeGreaterThanOrEqual(pior(outro));
  });
  it("cor escura demais para texto no fundo escuro é clareada até ficar legível", () => {
    expect(paraTextoNoEscuro(COR_PADRAO)).toBe(COR_PADRAO); // já passa: intacta
    const claro = paraTextoNoEscuro("#1E3A8A");
    expect(claro).not.toBe("#1E3A8A");
    expect(contraste(claro, "#222222")).toBeGreaterThanOrEqual(4.5);
    expect(contraste(paraTextoNoEscuro("#000000"), "#222222")).toBeGreaterThanOrEqual(4.5);
  });
  it("escurecer produz cor mais escura", () => {
    expect(contraste(escurecer("#0F766E"), "#000000")).toBeLessThan(contraste("#0F766E", "#000000"));
  });
});

describe("validarLogoRef", () => {
  it("aceita arquivo simples de imagem e URL https", () => {
    expect(validarLogoRef("logo.png")).toBe("logo.png");
    expect(validarLogoRef("minha-logo_2.SVG")).toBe("minha-logo_2.SVG");
    expect(validarLogoRef("https://x.com/a.webp?v=1")).toBe("https://x.com/a.webp?v=1");
  });
  it("rejeita http, javascript:, subpasta, '..', data: e vazio", () => {
    for (const ruim of ["http://x.com/a.png", "javascript:alert(1)", "../logo.png", "img/logo.png",
      "data:image/png;base64,AAAA", "logo.exe", "", "   ", null, 5, 'https://x.com/a".png']) {
      expect(validarLogoRef(ruim)).toBeNull();
    }
  });
});

describe("resolverMarca", () => {
  it("sem config de marca cai no padrão ZX, idêntico ao tema original", () => {
    const m = resolverMarca({});
    expect(m.primaria).toBe("#D97706");
    expect(m.secundaria).toBe("#F59E0B");
    expect(m.primariaRgb).toBe("217 119 6");
    expect(m.textoSobreMarca).toBe("#000000");
    expect(m.primariaTexto).toBe("#D97706");
    expect(m.secundariaTexto).toBe("#F59E0B");
    expect(m.logo).toBeNull();
    expect(m.nome).toBe("");
  });
  it("cor inválida cai no padrão; secundária inválida é ignorada", () => {
    const m = resolverMarca({ COR_PRIMARIA: "azul", COR_SECUNDARIA: "xx" });
    expect(m.primaria).toBe(COR_PADRAO);
    expect(m.secundaria).toBe(COR_SECUNDARIA_PADRAO);
  });
  it("primária própria sem secundária deriva uma versão mais escura", () => {
    const m = resolverMarca({ COR_PRIMARIA: "#0f766e" });
    expect(m.primaria).toBe("#0F766E");
    expect(m.secundaria).toBe(escurecer("#0F766E"));
    expect(m.primariaRgb).toBe("15 118 110");
  });
  it("secundária informada vale", () => {
    expect(resolverMarca({ COR_PRIMARIA: "#0F766E", COR_SECUNDARIA: "#abc" }).secundaria).toBe("#AABBCC");
  });
});

/** Mini-DOM: só o que aplicarMarca usa. */
function fakeDoc() {
  const props: Record<string, string> = {};
  const els: Record<string, any> = {};
  const mk = (id: string, texto: string) => (els[id] = {
    textContent: texto, children: [] as any[],
    appendChild(c: any) { this.children.push(c); },
  });
  mk("brand-login", "Clínica Cheia");
  mk("brand-header", "Clínica Cheia");
  return {
    props, els, title: "Painel da Clínica",
    documentElement: { style: { setProperty: (k: string, v: string) => { props[k] = v; } } },
    getElementById: (id: string) => els[id] ?? null,
    createElement: (_t: string) => {
      const ls: Record<string, () => void> = {};
      return { className: "", alt: "", src: "", addEventListener: (e: string, f: () => void) => { ls[e] = f; }, ls };
    },
  };
}

describe("aplicarMarca", () => {
  it("define as CSS vars, o título e o nome", () => {
    const d = fakeDoc();
    aplicarMarca({ CLINICA_NOME: "Bella", COR_PRIMARIA: "#0F766E" }, d as any);
    expect(d.props["--brand"]).toBe("#0F766E");
    expect(d.props["--brand-rgb"]).toBe("15 118 110");
    expect(d.props["--brand-on"]).toBe("#FFFFFF");
    expect(d.title).toBe("Painel — Bella");
    expect(d.els["brand-login"].textContent).toBe("Bella");
    expect(d.els["brand-header"].textContent).toBe("Bella");
  });
  it("com logo: <img> com alt = nome; se o logo quebrar, volta ao nome em texto", () => {
    const d = fakeDoc();
    aplicarMarca({ CLINICA_NOME: "Bella", LOGO: "logo.png" }, d as any);
    const img = d.els["brand-header"].children[0];
    expect(img.src).toBe("logo.png");
    expect(img.alt).toBe("Bella");
    expect(d.els["brand-header"].textContent).toBe("");
    img.ls.error();
    expect(d.els["brand-header"].textContent).toBe("Bella");
  });
  it("logo inválido é ignorado (nunca vira <img>) e sem nome mantém o texto padrão do HTML", () => {
    const d = fakeDoc();
    aplicarMarca({ LOGO: "javascript:alert(1)" }, d as any);
    expect(d.els["brand-header"].children.length).toBe(0);
    expect(d.els["brand-header"].textContent).toBe("Clínica Cheia");
    expect(d.title).toBe("Painel da Clínica");
  });
  it("não quebra com config vazia", () => {
    const d = fakeDoc();
    expect(() => aplicarMarca({}, d as any)).not.toThrow();
    expect(d.props["--brand"]).toBe("#D97706");
  });
});

describe("wizard: validação de marca", () => {
  it("nome é obrigatório", () => {
    expect(validarNome("  ").ok).toBe(false);
    expect(validarNome(" Bella ")).toEqual({ ok: true, valor: "Bella" });
  });
  it("cor primária: normaliza e rejeita inválida; secundária pode ser vazia", () => {
    expect(validarCor("#0a7", { obrigatoria: true })).toEqual({ ok: true, valor: "#00AA77" });
    expect(validarCor("verde", { obrigatoria: true }).ok).toBe(false);
    expect(validarCor("", { obrigatoria: true }).ok).toBe(false);
    expect(validarCor("")).toEqual({ ok: true, valor: "" });
    expect(validarCor("#12").ok).toBe(false);
  });

  const feitos: Array<[string, string]> = [];
  const arquivos = new Set(["/tmp/origem/minha logo.PNG", "/p/painel/logo.png", "/tmp/origem/x.gif"]);
  const deps = {
    painelDir: "/p/painel", home: "/home/aluno",
    existe: (c: string) => arquivos.has(c),
    copiar: (o: string, d: string) => { feitos.push([o, d]); },
    juntar: (a: string, b: string) => `${a}/${b}`,
    resolver: (c: string) => c,
  };
  it("logo vazio = sem logo", () => {
    expect(validarLogo("", deps)).toEqual({ ok: true, valor: "" });
  });
  it("URL https passa; http é rejeitada", () => {
    expect(validarLogo("https://x.com/l.png", deps)).toEqual({ ok: true, valor: "https://x.com/l.png" });
    expect(validarLogo("http://x.com/l.png", deps).ok).toBe(false);
  });
  it("arquivo local é copiado para painel/logo.<ext> (aspas e barra de escape toleradas)", () => {
    const r = validarLogo(`'/tmp/origem/minha\\ logo.PNG'`, deps);
    expect(r).toEqual({ ok: true, valor: "logo.png" });
    expect(feitos.at(-1)).toEqual(["/tmp/origem/minha logo.PNG", "/p/painel/logo.png"]);
  });
  it("re-execução: nome já dentro de painel/ é mantido sem copiar", () => {
    const antes = feitos.length;
    expect(validarLogo("logo.png", deps)).toEqual({ ok: true, valor: "logo.png" });
    expect(feitos.length).toBe(antes);
  });
  it("extensão fora da lista e arquivo inexistente são rejeitados", () => {
    expect(validarLogo("/tmp/origem/x.gif", deps).ok).toBe(false);
    expect(validarLogo("/tmp/origem/nao-existe.png", deps).ok).toBe(false);
  });
  it("limparCaminho expande ~", () => {
    expect(limparCaminho("~/Downloads/a.png", "/home/aluno")).toBe("/home/aluno/Downloads/a.png");
  });
});
