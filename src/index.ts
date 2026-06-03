import { parseConfig } from "./config";
import { makeDb } from "./db/client";
import { Agenda } from "./db/agenda";
import { makeAdapter, normalizeInbound } from "./whatsapp/adapter";
import { geminiChat } from "./llm/gemini";
import { handleInbound } from "./agents/recepcionista";
import { runConfirmador } from "./agents/confirmador";
import { runResgate } from "./agents/resgate";
import { runLembreteRetorno } from "./agents/lembrete-retorno";
import { runReativador } from "./agents/reativador";

export function agentesParaHora(hora: number): string[] {
  const map: Record<number, string[]> = {
    18: ["confirmador"],
    11: ["resgate"],
    10: ["lembrete-retorno"],
    9: ["reativador"],
  };
  return map[hora] ?? [];
}

function deps(env: any) {
  const cfg = parseConfig(env);
  const agenda = new Agenda(makeDb(cfg.supabase.url, cfg.supabase.key));
  const wa = makeAdapter(cfg.whatsapp);
  const llm = (p: { system: string; user: string }) =>
    geminiChat({ key: cfg.gemini.key, ...p });
  return { cfg, agenda, wa, llm };
}

export default {
  async fetch(req: Request, env: any, _ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname === "/webhook" && req.method === "POST") {
      try {
        const { cfg, agenda, wa, llm } = deps(env);
        const msg = normalizeInbound(cfg.whatsapp.provider, await req.json());
        if (msg) await handleInbound(msg, { llm, agenda, wa });
      } catch (e) {
        console.error("webhook erro", e);
      }
      return new Response("{}", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  },
  async scheduled(_evt: any, env: any): Promise<void> {
    const { cfg, agenda, wa } = deps(env);
    const agora = new Date();
    const horaBRT = Number(
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: "America/Sao_Paulo",
      }).format(agora)
    );
    const ags = agentesParaHora(horaBRT);
    if (ags.includes("confirmador")) await runConfirmador({ agenda, wa, agora });
    if (ags.includes("resgate")) await runResgate({ agenda, wa, agora });
    if (ags.includes("lembrete-retorno"))
      await runLembreteRetorno({ agenda, wa, agora });
    if (ags.includes("reativador"))
      await runReativador({ agenda, wa, agora, reviewLink: cfg.googleReviewLink });
  },
};
