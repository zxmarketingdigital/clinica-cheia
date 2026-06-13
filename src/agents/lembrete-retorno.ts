import { niche } from "../niche/clinica-estetica";
import type { AgenteCtx } from "./confirmador";
import { sendProativo } from "../lib/envio";

export async function runLembreteRetorno(ctx: AgenteCtx): Promise<void> {
  const venc = await ctx.agenda.realizadosComCadenciaVencendo(ctx.agora.toISOString());
  for (const v of venc) {
    try {
      if (await ctx.agenda.jaEnviouLembrete(v.cliente.telefone, v.procedimento.nome)) continue;
      const texto = niche.templates.lembreteRetorno({
        nome: v.cliente.nome,
        procedimento: v.procedimento.nome,
      });
      await sendProativo(ctx, v.cliente.telefone, texto, "lembrete-retorno", v.procedimento.nome);
    } catch (err) {
      console.error("[lembrete-retorno] erro ao processar item da cadência:", err);
    }
  }
}
