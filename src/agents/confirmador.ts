import { niche } from "../niche/clinica-estetica";
import { janelaDiaSeguinte, formatarQuando } from "../lib/tempo";

export interface AgenteCtx {
  agenda: any;
  wa: { send(telefone: string, mensagem: string): Promise<void> };
  agora: Date;
}

export async function runConfirmador(ctx: AgenteCtx): Promise<void> {
  const { de, ate } = janelaDiaSeguinte(ctx.agora);
  const ags = await ctx.agenda.agendamentosParaConfirmar(de, ate);
  for (const a of ags) {
    const cli = await ctx.agenda.clientePorId(a.cliente_id);
    const texto = niche.templates.confirmacao({ nome: cli.nome, quando: formatarQuando(a.inicio) });
    await ctx.wa.send(cli.telefone, texto);
    await ctx.agenda.logMensagem(cli.telefone, "out", texto, "confirmador");
  }
}
