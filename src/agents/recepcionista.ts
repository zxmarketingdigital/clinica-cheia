import { niche } from "../niche/clinica-estetica";
import { paraUTC } from "../lib/tempo";

const RE = /\[\[AGENDAR ([^\]]+)\]\]/;

function parseAgendar(s: string) {
  const m = s.match(RE);
  if (!m) return null;
  const kv = Object.fromEntries(
    m[1]!.split(/\s+(?=\w+=)/).map(p => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    })
  );
  return kv as { nome: string; procedimento: string; inicio: string };
}

export interface RecepCtx {
  llm: (p: { system: string; user: string }) => Promise<string>;
  agenda: any;
  wa: { send(t: string, m: string): Promise<void> };
}

export async function handleInbound(
  msg: { telefone: string; texto: string },
  ctx: RecepCtx
) {
  await ctx.agenda.logMensagem(msg.telefone, "in", msg.texto, "recepcionista");

  const system = `${niche.persona}\nProcedimentos: ${niche.procedimentosDefault.map(p => p.nome).join(", ")}.\nQuando tiver nome+procedimento+data/hora, inclua no fim: [[AGENDAR nome=.. procedimento=.. inicio=ISO8601]].`;

  const resp = await ctx.llm({ system, user: msg.texto });

  const ag = parseAgendar(resp);
  if (ag) {
    const d = new Date(ag.inicio);
    const nome = (ag.nome ?? "").slice(0, 200);
    if (nome && !isNaN(d.getTime()) && d.getTime() > Date.now()) {
      const cli = await ctx.agenda.upsertCliente(nome, msg.telefone);
      const proc = await ctx.agenda.procedimentoPorNome(ag.procedimento);
      await ctx.agenda.criarAgendamento(cli.id, proc?.id ?? null, paraUTC(ag.inicio));
    }
  }

  const limpo = resp.replace(RE, "").trim();
  await ctx.wa.send(msg.telefone, limpo);
  await ctx.agenda.logMensagem(msg.telefone, "out", limpo, "recepcionista");
}
