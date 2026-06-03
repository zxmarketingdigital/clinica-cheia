// painel/app.js — Clínica Cheia Painel
// Vanilla JS + supabase-js@2 via ESM CDN. Sem framework.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Config ──────────────────────────────────────────────────────────────────
const cfg = window.CLINICA_CONFIG ?? {};
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#9CA3AF;text-align:center;padding:24px;">
      <div>
        <p style="font-size:1.1rem;color:#EF4444;font-weight:700;margin-bottom:8px;">config.js não encontrado ou incompleto</p>
        <p>Copie <code>config.example.js</code> → <code>config.js</code> e preencha SUPABASE_URL e SUPABASE_ANON_KEY.</p>
      </div>
    </div>`;
  throw new Error('CLINICA_CONFIG ausente');
}

const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

// ─── State ────────────────────────────────────────────────────────────────────
let currentTab = 'agenda';
let agendaDate = todayISO();      // "YYYY-MM-DD"
let clientesBusca = '';
let allClientes = [];             // cache para busca offline
let procedimentosCache = {};      // { [id]: nome }

// ─── Utils ────────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toLocaleDateString('sv');   // "YYYY-MM-DD" via sv-SE locale
}

function fmtDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  const hoje = todayISO();
  if (isoDate === hoje) return 'Hoje';
  const dt = new Date(isoDate + 'T00:00:00');
  return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDatetime(ts) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv');
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_LABELS = {
  agendado:   'Agendado',
  confirmado: 'Confirmado',
  realizado:  'Realizado',
  cancelado:  'Cancelado',
  faltou:     'Faltou',
};

function badgeHtml(status) {
  return `<span class="badge badge-${escHtml(status)}">${escHtml(STATUS_LABELS[status] ?? status)}</span>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `visible ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3500);
}

// ─── Loading helpers ──────────────────────────────────────────────────────────
function loadingHtml() {
  return `<div class="loading-row"><span class="spinner"></span> Carregando…</div>`;
}

function emptyHtml(title, sub = '') {
  return `<div class="empty"><strong>${escHtml(title)}</strong>${sub ? escHtml(sub) : ''}</div>`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showApp(session.user);
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (session) {
      showApp(session.user);
    } else {
      showLogin();
    }
  });
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-screen').classList.remove('visible');
}

function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  const ms = document.getElementById('main-screen');
  ms.classList.add('visible');
  document.getElementById('header-email').textContent = user.email ?? '';
  document.getElementById('header-clinica-nome').textContent =
    cfg.CLINICA_NOME ? `— ${cfg.CLINICA_NOME}` : '';
  renderTab(currentTab);
}

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Entrando…';

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-senha').value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'Entrar';
  if (error) {
    errEl.textContent = error.message === 'Invalid login credentials'
      ? 'E-mail ou senha incorretos.'
      : error.message;
    errEl.style.display = 'block';
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === currentTab) return;

  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${tab}`).classList.add('active');

  currentTab = tab;
  renderTab(tab);
});

function renderTab(tab) {
  if (tab === 'agenda')        renderAgenda();
  else if (tab === 'clientes') renderClientes();
  else if (tab === 'procedimentos') renderProcedimentos();
  else if (tab === 'espera')   renderEspera();
  else if (tab === 'mensagens') renderMensagens();
}

// ─── Procedimentos cache ──────────────────────────────────────────────────────
async function loadProcedimentosCache() {
  const { data } = await sb.from('procedimentos').select('id,nome');
  if (data) {
    procedimentosCache = {};
    data.forEach(p => { procedimentosCache[p.id] = p.nome; });
  }
}

// ─── AGENDA DO DIA ────────────────────────────────────────────────────────────
function renderAgendaDateLabel() {
  document.getElementById('agenda-date').textContent = fmtDate(agendaDate);
}

async function renderAgenda() {
  renderAgendaDateLabel();
  const list = document.getElementById('agenda-list');
  list.innerHTML = loadingHtml();

  await loadProcedimentosCache();

  // fetch agendamentos do dia com dados do cliente
  const start = agendaDate + 'T00:00:00';
  const end   = agendaDate + 'T23:59:59';

  const { data, error } = await sb
    .from('agendamentos')
    .select('id, inicio, status, cliente_id, procedimento_id, clientes(nome, telefone)')
    .gte('inicio', start)
    .lte('inicio', end)
    .order('inicio', { ascending: true });

  if (error) {
    list.innerHTML = `<div class="empty" style="color:var(--red)">Erro ao carregar: ${escHtml(error.message)}</div>`;
    return;
  }

  const countEl = document.getElementById('agenda-count');
  countEl.textContent = data.length ? `${data.length} agendamento${data.length > 1 ? 's' : ''}` : '';

  if (!data.length) {
    list.innerHTML = emptyHtml('Nenhum agendamento neste dia', 'A agenda está livre.');
    return;
  }

  list.innerHTML = data.map(ag => agendaCardHtml(ag)).join('');

  // attach action buttons
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAgendaAction(btn.dataset.id, btn.dataset.action));
  });
}

function agendaCardHtml(ag) {
  const nome = ag.clientes?.nome ?? '—';
  const tel  = ag.clientes?.telefone ?? '';
  const proc = procedimentosCache[ag.procedimento_id] ?? 'Procedimento não informado';
  const hora = fmtTime(ag.inicio);
  const isTerminal = ag.status === 'realizado' || ag.status === 'cancelado' || ag.status === 'faltou';

  const actionButtons = isTerminal
    ? `<span style="font-size:0.78rem;color:var(--text-muted);font-style:italic;">Finalizado</span>`
    : `
      ${ag.status !== 'confirmado' ? `<button class="btn btn-sm btn-confirmado" data-id="${ag.id}" data-action="confirmado" aria-label="Marcar como confirmado">Confirmado</button>` : ''}
      <button class="btn btn-sm btn-realizado"  data-id="${ag.id}" data-action="realizado"  aria-label="Marcar como realizado">Realizado</button>
      <button class="btn btn-sm btn-faltou"     data-id="${ag.id}" data-action="faltou"     aria-label="Marcar como faltou">Faltou</button>
      <button class="btn btn-sm btn-cancelar"   data-id="${ag.id}" data-action="cancelado"  aria-label="Cancelar agendamento">Cancelar</button>
    `;

  return `
    <div class="card" id="ag-${ag.id}">
      <div class="agenda-row">
        <span class="agenda-time">${escHtml(hora)}</span>
        <div class="agenda-info">
          <div class="agenda-nome">${escHtml(nome)}</div>
          <div class="agenda-proc">${escHtml(proc)}${tel ? ` · <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;">${escHtml(tel)}</span>` : ''}</div>
        </div>
        ${badgeHtml(ag.status)}
        <div class="agenda-actions">${actionButtons}</div>
      </div>
    </div>`;
}

async function handleAgendaAction(id, novoStatus) {
  // Optimistic UI: disable all buttons on this card
  const card = document.getElementById(`ag-${id}`);
  if (card) {
    card.querySelectorAll('button[data-action]').forEach(b => { b.disabled = true; });
  }

  const extra = novoStatus === 'confirmado' ? { confirmado_em: new Date().toISOString() } : {};

  const { error } = await sb
    .from('agendamentos')
    .update({ status: novoStatus, ...extra })
    .eq('id', id);

  if (error) {
    toast(`Erro ao atualizar: ${error.message}`, 'error');
    if (card) card.querySelectorAll('button[data-action]').forEach(b => { b.disabled = false; });
    return;
  }

  toast(`Status → ${STATUS_LABELS[novoStatus]}`, 'success');
  renderAgenda(); // re-render to reflect new state
}

// Date navigation
document.getElementById('agenda-prev').addEventListener('click', () => {
  agendaDate = addDays(agendaDate, -1);
  renderAgenda();
});
document.getElementById('agenda-next').addEventListener('click', () => {
  agendaDate = addDays(agendaDate, 1);
  renderAgenda();
});
document.getElementById('agenda-hoje').addEventListener('click', () => {
  agendaDate = todayISO();
  renderAgenda();
});

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
async function renderClientes() {
  const list = document.getElementById('clientes-list');
  list.innerHTML = loadingHtml();

  const { data, error } = await sb
    .from('clientes')
    .select('id, nome, telefone, criado_em')
    .order('nome', { ascending: true });

  if (error) {
    list.innerHTML = `<div class="empty" style="color:var(--red)">Erro: ${escHtml(error.message)}</div>`;
    return;
  }

  allClientes = data ?? [];
  renderClientesFiltrados();
}

function renderClientesFiltrados() {
  const list = document.getElementById('clientes-list');
  const q = clientesBusca.toLowerCase();
  const filtered = q
    ? allClientes.filter(c => c.nome.toLowerCase().includes(q) || c.telefone.includes(q))
    : allClientes;

  if (!filtered.length) {
    list.innerHTML = emptyHtml(
      allClientes.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado',
      allClientes.length ? 'Tente outro termo de busca.' : 'Adicione o primeiro cliente.'
    );
    return;
  }

  list.innerHTML = filtered.map(c => `
    <div class="list-item">
      <div>
        <div class="list-item-title">${escHtml(c.nome)}</div>
        <div class="list-item-sub">
          <span style="font-family:'JetBrains Mono',monospace;">${escHtml(c.telefone)}</span>
          · cadastrado ${fmtDatetime(c.criado_em)}
        </div>
      </div>
    </div>`).join('');
}

// Busca com debounce
let buscaTimer = null;
document.getElementById('clientes-busca').addEventListener('input', (e) => {
  clearTimeout(buscaTimer);
  buscaTimer = setTimeout(() => {
    clientesBusca = e.target.value.trim();
    renderClientesFiltrados();
  }, 220);
});

// Modal novo cliente
document.getElementById('btn-novo-cliente').addEventListener('click', () => {
  openModalCliente();
});
document.getElementById('btn-cancelar-cliente').addEventListener('click', closeModalCliente);
document.getElementById('modal-cliente').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModalCliente();
});

function openModalCliente() {
  document.getElementById('c-nome').value = '';
  document.getElementById('c-telefone').value = '';
  document.getElementById('modal-cliente-error').style.display = 'none';
  document.getElementById('modal-cliente').classList.remove('hidden');
  document.getElementById('c-nome').focus();
}

function closeModalCliente() {
  document.getElementById('modal-cliente').classList.add('hidden');
}

document.getElementById('form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('modal-cliente-error');
  const btn   = document.getElementById('btn-salvar-cliente');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const nome     = document.getElementById('c-nome').value.trim();
  const telefone = document.getElementById('c-telefone').value.trim();

  const { error } = await sb.from('clientes').insert({ nome, telefone });

  btn.disabled = false;
  btn.textContent = 'Salvar';

  if (error) {
    errEl.textContent = error.code === '23505'
      ? 'Já existe um cliente com este telefone.'
      : error.message;
    errEl.style.display = 'block';
    return;
  }

  toast('Cliente cadastrado!');
  closeModalCliente();
  clientesBusca = '';
  document.getElementById('clientes-busca').value = '';
  renderClientes();
});

// ─── PROCEDIMENTOS ────────────────────────────────────────────────────────────
async function renderProcedimentos() {
  const list = document.getElementById('procedimentos-list');
  list.innerHTML = loadingHtml();

  const { data, error } = await sb
    .from('procedimentos')
    .select('id, nome, duracao_min, cadencia_retorno_dias, preco_centavos')
    .order('nome', { ascending: true });

  if (error) {
    list.innerHTML = `<div class="empty" style="color:var(--red)">Erro: ${escHtml(error.message)}</div>`;
    return;
  }

  if (!data.length) {
    list.innerHTML = emptyHtml('Nenhum procedimento cadastrado');
    return;
  }

  list.innerHTML = data.map(p => procedimentoItemHtml(p)).join('');

  list.querySelectorAll('[data-save-proc]').forEach(btn => {
    btn.addEventListener('click', () => saveProcedimento(btn.dataset.id));
  });
}

function procedimentoItemHtml(p) {
  const preco = p.preco_centavos != null
    ? (p.preco_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
  return `
    <div class="list-item" id="proc-${p.id}">
      <div style="flex:1;min-width:0;">
        <div class="list-item-title">${escHtml(p.nome)}</div>
        <div class="list-item-sub" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
          <div class="inline-edit">
            <label for="dur-${p.id}">Duração</label>
            <input type="number" id="dur-${p.id}" value="${escHtml(p.duracao_min)}" min="5" max="480" step="5" aria-label="Duração em minutos" />
            <label for="dur-${p.id}">min</label>
          </div>
          <div class="inline-edit">
            <label for="cad-${p.id}">Retorno</label>
            <input type="number" id="cad-${p.id}" value="${p.cadencia_retorno_dias ?? ''}" min="1" max="730" placeholder="—" aria-label="Cadência de retorno em dias" />
            <label for="cad-${p.id}">dias</label>
          </div>
          <span style="font-size:0.8rem;color:var(--text-muted);">${escHtml(preco)}</span>
        </div>
      </div>
      <div class="list-item-actions">
        <button class="btn btn-primary btn-sm" data-save-proc data-id="${p.id}" aria-label="Salvar alterações em ${escHtml(p.nome)}">Salvar</button>
      </div>
    </div>`;
}

async function saveProcedimento(id) {
  const durEl = document.getElementById(`dur-${id}`);
  const cadEl = document.getElementById(`cad-${id}`);
  const btn = document.querySelector(`[data-save-proc][data-id="${id}"]`);

  const duracao_min = parseInt(durEl.value, 10);
  const cadRaw = cadEl.value.trim();
  const cadencia_retorno_dias = cadRaw === '' ? null : parseInt(cadRaw, 10);

  if (isNaN(duracao_min) || duracao_min < 5) {
    toast('Duração inválida (mínimo 5 min).', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = '…';

  const { error } = await sb
    .from('procedimentos')
    .update({ duracao_min, cadencia_retorno_dias })
    .eq('id', id);

  btn.disabled = false;
  btn.textContent = 'Salvar';

  if (error) {
    toast(`Erro: ${error.message}`, 'error');
    return;
  }

  toast('Procedimento atualizado!');
  // update cache
  procedimentosCache[id] = procedimentosCache[id]; // nome unchanged
}

// ─── LISTA DE ESPERA ──────────────────────────────────────────────────────────
async function renderEspera() {
  const list = document.getElementById('espera-list');
  list.innerHTML = loadingHtml();

  await loadProcedimentosCache();

  const { data, error } = await sb
    .from('lista_espera')
    .select('id, criado_em, atendido, cliente_id, procedimento_id, clientes(nome, telefone)')
    .eq('atendido', false)
    .order('criado_em', { ascending: true });

  const countEl = document.getElementById('espera-count');

  if (error) {
    countEl.textContent = '';
    list.innerHTML = `<div class="empty" style="color:var(--red)">Erro: ${escHtml(error.message)}</div>`;
    return;
  }

  countEl.textContent = data.length ? `${data.length} aguardando` : '';

  if (!data.length) {
    list.innerHTML = emptyHtml('Lista de espera vazia', 'Nenhum cliente aguardando atendimento.');
    return;
  }

  list.innerHTML = data.map(item => {
    const nome = item.clientes?.nome ?? '—';
    const tel  = item.clientes?.telefone ?? '';
    const proc = procedimentosCache[item.procedimento_id] ?? '—';
    return `
      <div class="list-item">
        <div>
          <div class="list-item-title">${escHtml(nome)}</div>
          <div class="list-item-sub">
            ${escHtml(proc)}
            ${tel ? ` · <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;">${escHtml(tel)}</span>` : ''}
            · na espera desde ${fmtDatetime(item.criado_em)}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── MENSAGENS ────────────────────────────────────────────────────────────────
async function renderMensagens() {
  const list = document.getElementById('mensagens-list');
  list.innerHTML = loadingHtml();

  const { data, error } = await sb
    .from('mensagens')
    .select('id, telefone, direcao, agente, corpo, criado_em')
    .order('criado_em', { ascending: false })
    .limit(60);

  if (error) {
    list.innerHTML = `<div class="empty" style="color:var(--red)">Erro: ${escHtml(error.message)}</div>`;
    return;
  }

  if (!data.length) {
    list.innerHTML = emptyHtml('Nenhuma mensagem registrada', 'As mensagens enviadas pelos agentes aparecerão aqui.');
    return;
  }

  list.innerHTML = data.map(m => {
    const dirColor = m.direcao === 'out' ? 'var(--amber-light)' : 'var(--indigo)';
    const dirLabel = m.direcao === 'out' ? '↑ Enviada' : '↓ Recebida';
    return `
      <div class="list-item">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;color:var(--text);">${escHtml(m.telefone)}</span>
            <span style="font-size:0.72rem;font-weight:700;color:${dirColor};">${dirLabel}</span>
            ${m.agente ? `<span style="font-size:0.72rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">${escHtml(m.agente)}</span>` : ''}
            <span style="font-size:0.72rem;color:var(--text-muted);margin-left:auto;">${fmtDatetime(m.criado_em)}</span>
          </div>
          <div style="font-size:0.85rem;color:var(--text-sec);white-space:pre-wrap;word-break:break-word;">${escHtml(m.corpo)}</div>
        </div>
      </div>`;
  }).join('');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
initAuth();
