import { niche } from "../niche/clinica-estetica";
import { janelaDiaSeguinte, formatarQuando } from "../lib/tempo";
import { sendProativo } from "../lib/envio";

export interface AgenteCtx {
  agenda: any;
  wa: { send(telefone: string, mensagem: string): Promise<void> };
  agora: Date;
}

export async function runConfirmador(ctx: AgenteCtx): Promise<void> {
  const { de, ate } = janelaDiaSeguinte(ctx.agora);
  const ags = await ctx.agenda.agendamentosParaConfirmar(de, ate);
  for (const a of ags) {
    try {
      const cli = await ctx.agenda.clientePorId(a.cliente_id);
      const texto = niche.templates.confirmacao({ nome: cli.nome, quando: formatarQuando(a.inicio) });
      await sendProativo(ctx, cli.telefone, texto, "confirmador");
    } catch (err) {
      console.error(`[confirmador] erro ao processar agendamento ${a.id}:`, err);
    }
  }
}
