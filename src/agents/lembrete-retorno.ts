import { niche } from "../niche/clinica-estetica";
import type { AgenteCtx } from "./confirmador";

export async function runLembreteRetorno(ctx: AgenteCtx): Promise<void> {
  const venc = await ctx.agenda.realizadosComCadenciaVencendo(ctx.agora.toISOString());
  for (const v of venc) {
    if (await ctx.agenda.jaEnviouLembrete(v.cliente.telefone, v.procedimento.nome)) continue;
    const texto = niche.templates.lembreteRetorno({
      nome: v.cliente.nome,
      procedimento: v.procedimento.nome,
    });
    await ctx.wa.send(v.cliente.telefone, texto);
    await ctx.agenda.logMensagem(v.cliente.telefone, "out", texto, "lembrete-retorno");
  }
}
