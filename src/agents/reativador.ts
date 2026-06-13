import { niche } from "../niche/clinica-estetica";
import type { AgenteCtx } from "./confirmador";
import { sendProativo } from "../lib/envio";

export interface ReativadorCtx extends AgenteCtx {
  reviewLink: string;
}

const DIAS_INATIVO = 90;

export async function runReativador(ctx: ReativadorCtx): Promise<void> {
  const corte = new Date(ctx.agora.getTime() - DIAS_INATIVO * 86400000).toISOString();

  const inativos = await ctx.agenda.inativosDesde(corte);
  for (const i of inativos) {
    try {
      if (await ctx.agenda.jaEnviouReativacao(i.cliente.telefone)) continue;
      const texto = niche.templates.reativacao({ nome: i.cliente.nome });
      await sendProativo(ctx, i.cliente.telefone, texto, "reativador");
    } catch (err) {
      console.error("[reativador] erro ao processar inativo:", err);
    }
  }

  const ontem = await ctx.agenda.realizadosOntem(ctx.agora.toISOString());
  for (const o of ontem) {
    try {
      if (await ctx.agenda.jaPediuAvaliacao(o.cliente.telefone)) continue;
      const texto = niche.templates.pedidoAvaliacao({ nome: o.cliente.nome, link: ctx.reviewLink });
      await sendProativo(ctx, o.cliente.telefone, texto, "avaliacao-google");
    } catch (err) {
      console.error("[reativador] erro ao pedir avaliação:", err);
    }
  }
}
