import { niche } from "../niche/clinica-estetica";
import type { AgenteCtx } from "./confirmador";

export interface ReativadorCtx extends AgenteCtx {
  reviewLink: string;
}

const DIAS_INATIVO = 90;

export async function runReativador(ctx: ReativadorCtx): Promise<void> {
  const corte = new Date(ctx.agora.getTime() - DIAS_INATIVO * 86400000).toISOString();

  const inativos = await ctx.agenda.inativosDesde(corte);
  for (const i of inativos) {
    const texto = niche.templates.reativacao({ nome: i.cliente.nome });
    await ctx.wa.send(i.cliente.telefone, texto);
    await ctx.agenda.logMensagem(i.cliente.telefone, "out", texto, "reativador");
  }

  const ontem = await ctx.agenda.realizadosOntem(ctx.agora.toISOString());
  for (const o of ontem) {
    const texto = niche.templates.pedidoAvaliacao({ nome: o.cliente.nome, link: ctx.reviewLink });
    await ctx.wa.send(o.cliente.telefone, texto);
    await ctx.agenda.logMensagem(o.cliente.telefone, "out", texto, "reativador");
  }
}
