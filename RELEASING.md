# Processo de Release Congelada — Clínica Cheia

O núcleo é distribuído como **tag versionada**. O aluno sempre instala (e atualiza) a partir de
uma tag, nunca da `main`. Isso garante que cada clínica roda código estável e testado, sem ser
surpreendida por mudanças intermediárias.

---

## Regra de ouro

> **Só se cria tag sobre um commit que passou no CI (verde).**

Nunca criar tag sobre commit com `push` ainda em andamento ou com job vermelho.

---

## Instalação pelo aluno

```bash
# Clonar uma versão específica (nunca clonar main)
git clone --branch v1.0.0 https://github.com/zxmarketingdigital/clinica-cheia nucleo
```

---

## Versionamento semântico

| Tipo | Quando usar | Exemplo |
|------|-------------|---------|
| **patch** | Bugfix sem mudança de contrato | `v1.0.1` |
| **minor** | Feature nova, totalmente compatível com configs existentes | `v1.1.0` |
| **major** | Breaking change — aluno precisa ajustar `wrangler.toml` ou variáveis | `v2.0.0` |

---

## Como cortar uma release

1. **Garantir CI verde na `main`** — aguardar o job passar em GitHub Actions antes de continuar.

2. **Atualizar CHANGELOG** (se o projeto mantiver um) — anotar o que mudou nesta versão.

3. **Criar e publicar a tag:**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. **Avisar os alunos** — comunicar a nova versão no grupo/área de membros, descrevendo o que
   mudou e se há breaking changes.

---

## Como o aluno atualiza uma clínica

Cada clínica roda na infra do próprio aluno (Supabase + Cloudflare dele); o update é
**descentralizado** — o aluno executa por clínica:

```bash
# Na pasta do núcleo da clínica
git fetch --tags
git checkout v1.2.3

# Redeployar o Worker
pnpm install --frozen-lockfile
pnpm exec wrangler deploy
```

> Em caso de major version, ler as notas da release antes de fazer o checkout — pode haver
> variáveis novas para adicionar ao `wrangler.toml` ou ao painel Cloudflare.
