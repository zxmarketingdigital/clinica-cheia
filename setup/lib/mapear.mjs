/**
 * setup/lib/mapear.mjs
 * Mappers PUROS e testáveis para o importador de planilha.
 *
 * PRINCÍPIO: este módulo é stateless e sem side-effects.
 * Nenhuma lógica de agente aqui — só normalização de dados.
 */

/**
 * Normaliza um telefone para E.164 simplificado (só dígitos, DDI 55 prefixado).
 * - Remove tudo que não é dígito.
 * - Se o resultado tiver 10 ou 11 dígitos, prefixa "55" (Brasil).
 * - Se já começar com "55" e tiver 12-13 dígitos, mantém como está.
 * @param {string} t
 * @returns {string}
 */
export function normalizarTelefone(t) {
  const digits = String(t).replace(/\D/g, "");
  // Já tem DDI 55 e comprimento válido (12=fixo, 13=celular com 9)
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }
  // Número nacional: 10 dígitos (DDD+fixo) ou 11 dígitos (DDD+9+cel)
  if (digits.length >= 10 && digits.length <= 11) {
    return "55" + digits;
  }
  // Já veio com DDI mas sem prefixo 55 verificado acima → devolve como está
  return digits;
}

/**
 * Chaves aceitas para nome do cliente (case-insensitive lookup).
 */
const NOME_KEYS = ["nome", "cliente", "name"];

/**
 * Chaves aceitas para telefone do cliente (case-insensitive lookup).
 */
const TELEFONE_KEYS = ["telefone", "celular", "whatsapp", "fone", "phone"];

/**
 * Busca o valor de `obj` para a primeira chave (case-insensitive) encontrada em `candidates`.
 * @param {Record<string, unknown>} obj
 * @param {string[]} candidates
 * @returns {string | undefined}
 */
function findKey(obj, candidates) {
  const lower = Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const key of candidates) {
    if (lower[key] !== undefined && lower[key] !== null && lower[key] !== "") {
      return String(lower[key]);
    }
  }
  return undefined;
}

/**
 * Mapeia uma linha de CSV/objeto para o formato de cliente.
 * Aceita chaves variadas (case-insensitive) para nome e telefone.
 *
 * @param {Record<string, unknown>} row
 * @returns {{ nome: string; telefone: string } | null}
 */
export function mapearLinhaCliente(row) {
  const nomeRaw = findKey(row, NOME_KEYS);
  const telefoneRaw = findKey(row, TELEFONE_KEYS);

  if (!nomeRaw || !telefoneRaw) return null;

  const nome = nomeRaw.trim();
  if (!nome) return null;

  const telefone = normalizarTelefone(telefoneRaw);
  // Rejeita telefone que não virou número útil (ex: string vazia ou muito curta)
  if (telefone.length < 10) return null;

  return { nome, telefone };
}
