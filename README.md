# Clínica Cheia 🦷✨

Sistema pronto de **5 agentes de WhatsApp para clínicas de estética** — você instala para o cliente e cobra por isso.

| Agente | O que faz |
|---|---|
| 🗓️ Recepcionista | Atende o WhatsApp 24/7 e agenda |
| ✅ Confirmador | Confirma o horário na véspera (mata o no-show) |
| 🔁 Resgate + lista de espera | Reconvida quem faltou e preenche vaga aberta |
| 💖 Lembrete de retorno | Chama de volta no tempo certo (botox, limpeza…) |
| 🌟 Reativador + avaliação | Reativa cliente sumido e pede avaliação no Google |

Roda **serverless** (Cloudflare Workers + Supabase), cérebro **Google Gemini**, WhatsApp via **uazapi**.

---

## Como instalar para uma clínica

Você **não programa nada** — o Claude Code configura tudo conversando com você:

```bash
gh repo clone zxmarketingdigital/clinica-cheia
cd clinica-cheia
claude
```

Depois é só dizer ao Claude:

> **"Configura o Clínica Cheia pra minha clínica."**

O Claude vai pedir as credenciais (Supabase, Gemini, WhatsApp, link do Google) uma a uma, preencher
tudo, aplicar o banco, fazer o deploy e validar com um teste. As instruções que ele segue estão em
[`CLAUDE.md`](./CLAUDE.md).

> Prefere um wizard de terminal em vez do chat? `node setup/configure.mjs` faz o mesmo de forma scriptada.

---

## Para desenvolvedores / mantenedores

```bash
pnpm install
pnpm vitest run        # 50 testes (os 5 agentes validados)
pnpm typecheck         # tsc src + testes
```

Lógica em `src/` (congelada — clínicas recebem por **tag** `vX.Y.Z`, ver [`RELEASING.md`](./RELEASING.md)).
O que muda por nicho vive em `src/niche/`. O que muda por clínica vive no `.env` (ver `.env.example`).
