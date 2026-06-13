// Chokepoint ÚNICO de envio proativo. Todo agente proativo (confirmador, resgate,
// lista de espera, lembrete de retorno, reativador, avaliação) DEVE enviar por aqui —
// nunca chamar ctx.wa.send direto — pra garantir o opt-out (LGPD) em um lugar só.
interface EnvioCtx {
  agenda: { clienteOptOut(telefone: string): Promise<boolean>; logMensagem(telefone: string, direcao: "in" | "out", corpo: string, agente?: string, ref?: string): Promise<void> };
  wa: { send(telefone: string, texto: string): Promise<void> };
}

/**
 * Envia mensagem proativa respeitando opt-out. Retorna true se enviou, false se
 * o cliente está em opt-out (silenciosamente pulado).
 */
export async function sendProativo(
  ctx: EnvioCtx,
  telefone: string,
  texto: string,
  agente: string,
  ref?: string
): Promise<boolean> {
  if (await ctx.agenda.clienteOptOut(telefone)) return false;
  await ctx.wa.send(telefone, texto);
  // preserva a assinatura original: só passa ref quando existe (não trailing undefined).
  if (ref !== undefined) await ctx.agenda.logMensagem(telefone, "out", texto, agente, ref);
  else await ctx.agenda.logMensagem(telefone, "out", texto, agente);
  return true;
}
