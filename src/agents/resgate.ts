import { niche } from "../niche/clinica-estetica";
import type { AgenteCtx } from "./confirmador";
import { janelaDiaAnterior } from "../lib/tempo";

/**
 * Varre agendamentos do DIA ANTERIOR em BRT ainda em status agendado/confirmado
 * (no-shows), marca cada um como "faltou" e envia o template de resgate ao cliente.
 *
 * Usa janela fechada [ontem 00:00 BRT, ontem 23:59:59 BRT) para evitar varrer
 * todo o histórico e disparar mensagens em massa.
 *
 * Deve ser chamado por um Cron Trigger (ex: diariamente às 20h).
 */
export async function runResgate(ctx: AgenteCtx): Promise<void> {
  const { de, ate } = janelaDiaAnterior(ctx.agora);
  const faltas = await ctx.agenda.faltasRecentes(de, ate);
  for (const f of faltas) {
    try {
      await ctx.agenda.marcarFaltou(f.id);
      const texto = niche.templates.resgate({ nome: f.cliente.nome });
      await ctx.wa.send(f.cliente.telefone, texto);
      await ctx.agenda.logMensagem(f.cliente.telefone, "out", texto, "resgate");
    } catch (err) {
      console.error(`[resgate] erro ao processar falta ${f.id}:`, err);
    }
  }
}

/**
 * Quando uma vaga é aberta (cancelamento, remarcação), oferta o horário
 * ao próximo cliente da lista de espera para o procedimento indicado.
 *
 * @param procedimento_id  ID do procedimento liberado, ou null para qualquer.
 */
export async function ofertarVaga(
  ctx: AgenteCtx,
  procedimento_id: string | null
): Promise<void> {
  const prox = await ctx.agenda.proximoListaEspera(procedimento_id);
  if (!prox) return;
  const texto = niche.templates.convidarVaga({ nome: prox.cliente.nome });
  await ctx.wa.send(prox.cliente.telefone, texto);
  await ctx.agenda.marcarListaEsperaAtendido(prox.id);
  await ctx.agenda.logMensagem(prox.cliente.telefone, "out", texto, "lista-espera");
}
