(function () {
  'use strict';

  const STORAGE_KEY = 'sgdb_token';
  const STORAGE_USER = 'sgdb_user';

  const state = {
    token: null,
    user: null,
    page: 'chamados',
    catalogo: { categorias: [], prioridades: [], status: [] },
    tecnicos: [],
    hardware: [],
    pecas: [],
    chamados: [],
    slaInterval: null,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function loadSession() {
    state.token = localStorage.getItem(STORAGE_KEY);
    try {
      state.user = JSON.parse(localStorage.getItem(STORAGE_USER) || 'null');
    } catch {
      state.user = null;
    }
  }

  function saveSession(token, usuario) {
    state.token = token;
    state.user = usuario;
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(usuario));
  }

  function clearSession() {
    state.token = null;
    state.user = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER);
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(`/api${path}`, { ...options, headers });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { erro: text || res.statusText };
    }
    if (!res.ok) {
      const err = new Error(data?.erro || res.statusText || 'Erro na requisição');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function toast(msg, type = 'ok') {
    const stack = $('#toast-stack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'err' ? 'err' : 'ok'}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 4500);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  function badgeClass(codigo) {
    const c = (codigo || '').toLowerCase().replace(/\s+/g, '_');
    return `badge badge-${c}`;
  }

  /**
   * Renderiza o HTML do cronômetro de SLA.
   * Se o técnico ainda não foi atribuído, exibe 'Aguardando atribuição'.
   * Caso o chamado esteja fechado ou resolvido, exibe apenas a data.
   * @param {string|null} prazo - A data ISO de vencimento do SLA.
   * @param {string} status - O código do status atual do chamado.
   * @returns {string} HTML string com a span do timer.
   */
  function renderSLA(prazo, status) {
    if (!prazo) return '<span class="sla-timer waiting">Aguardando atribuição</span>';
    if (['RESOLVIDO', 'FECHADO'].includes(status)) return `<span class="muted small">${formatDate(prazo)}</span>`;
    
    const now = new Date();
    const end = new Date(prazo);
    const diff = end - now;
    
    if (diff <= 0) return `<span class="sla-timer danger">VENCIDO (${formatDate(prazo)})</span>`;
    
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    const timeStr = `${h}h ${m}m ${s}s`;
    const isDanger = h < 2;
    return `<span class="sla-timer ${isDanger ? 'danger' : ''}" data-prazo="${prazo}">${timeStr}</span>`;
  }

  /**
   * Inicia o loop de atualização a cada 1 segundo (setInterval).
   * Ele busca todas as tags com data-prazo na tela e recalcula o tempo restante,
   * aplicando a classe 'danger' se faltar menos de 2 horas.
   */
  function startSLAUpdater() {
    if (state.slaInterval) clearInterval(state.slaInterval);
    state.slaInterval = setInterval(() => {
      $$('.sla-timer[data-prazo]').forEach(el => {
        const prazo = el.dataset.prazo;
        const now = new Date();
        const end = new Date(prazo);
        const diff = end - now;
        
        if (diff <= 0) {
          el.textContent = `VENCIDO (${formatDate(prazo)})`;
          el.classList.add('danger');
          delete el.dataset.prazo;
          return;
        }
        
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${h}h ${m}m ${s}s`;
        if (h < 2) el.classList.add('danger');
      });
    }, 1000);
  }

  function hasPerfil(...codigos) {
    const p = state.user?.perfis || [];
    return codigos.some((c) => p.includes(c));
  }

  function showScreen(id) {
    $('#screen-login').hidden = id !== 'login';
    $('#screen-app').hidden = id !== 'app';
  }

  function setAvatar() {
    const name = state.user?.nome_usuario || '?';
    $('#user-avatar').textContent = name.slice(0, 1).toUpperCase();
    $('#user-name').textContent = name;
    $('#user-perfis').textContent = (state.user?.perfis || []).join(', ') || '—';
  }

  function renderNav() {
    const nav = $('#nav-main');
    const items = [
      { id: 'chamados', label: 'Chamados', icon: 'inbox' },
      { id: 'novo', label: 'Novo chamado', icon: 'add_circle' },
      { id: 'inventario', label: 'Inventário', icon: 'inventory_2' },
    ];
    if (hasPerfil('ADMIN')) {
      items.push({ id: 'empresas', label: 'Empresas', icon: 'business' });
      items.push({ id: 'tecnicos', label: 'Técnicos', icon: 'build' });
    }
    if (hasPerfil('ADMIN', 'EMPRESA_ADMIN')) {
      items.push({ id: 'usuarios', label: 'Usuários', icon: 'group' });
    }
    nav.innerHTML = items
      .map(
        (it) =>
          `<button type="button" class="nav-item${state.page === it.id ? ' active' : ''}" data-nav="${it.id}"><span class="material-symbols-outlined nav-icon" aria-hidden="true" style="font-size:1.2rem; margin-right:0.5rem">${it.icon}</span> ${it.label}</button>`
      )
      .join('');
    $$('.nav-item', nav).forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.nav));
    });
  }

  async function navigate(page) {
    state.page = page;
    renderNav();
    const title = $('#page-title');
    const actions = $('#page-actions');
    actions.innerHTML = '';
    if (page === 'chamados') {
      title.textContent = 'Chamados';
      actions.innerHTML =
        '<button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-chamados">Atualizar</button>';
      $('#btn-refresh-chamados')?.addEventListener('click', () => loadChamados());
      await loadChamados();
    } else if (page === 'novo') {
      title.textContent = 'Novo chamado';
      await loadCatalogo();
      await loadHardwareList();
      renderNovoChamado();
    } else if (page === 'inventario') {
      title.textContent = 'Inventário de hardware';
      actions.innerHTML =
        '<button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-hw">Atualizar</button>';
      $('#btn-refresh-hw')?.addEventListener('click', () => loadInventario());
      await loadInventario();
    } else if (page === 'empresas') {
      title.textContent = 'Empresas Clientes';
      actions.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-empresas">Atualizar</button>';
      $('#btn-refresh-empresas')?.addEventListener('click', () => loadEmpresas());
      await loadEmpresas();
    } else if (page === 'usuarios') {
      title.textContent = 'Usuários';
      actions.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-usuarios">Atualizar</button>';
      $('#btn-refresh-usuarios')?.addEventListener('click', () => loadUsuarios());
      await loadUsuarios();
    } else if (page === 'tecnicos') {
      title.textContent = 'Técnicos e Vínculos';
      actions.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-tecnicos">Atualizar</button>';
      $('#btn-refresh-tecnicos')?.addEventListener('click', () => loadTecnicosList());
      await loadTecnicosList();
    }
  }

  async function loadEmpresas() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const empresas = await api('/empresas');
      content.innerHTML = `
        <div class="card form-panel">
          <form id="form-nova-empresa" class="form-stack">
            <div class="grid-2">
              <label class="field"><span>Nome Fantasia</span><input name="nome_fantasia" required /></label>
              <label class="field"><span>CNPJ</span><input name="cnpj" required /></label>
            </div>
            <button type="submit" class="btn btn-primary">Cadastrar Empresa</button>
          </form>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>ID</th><th>Empresa</th><th>CNPJ</th><th>Criado em</th></tr></thead>
            <tbody>
              ${empresas.map(e => `<tr><td data-label="ID">${e.id_empresa}</td><td data-label="Empresa">${escapeHtml(e.nome_fantasia)}</td><td data-label="CNPJ">${escapeHtml(e.cnpj)}</td><td data-label="Criado em">${formatDate(e.criado_em)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      $('#form-nova-empresa').addEventListener('submit', async ev => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await api('/empresas', { method: 'POST', body: { nome_fantasia: fd.get('nome_fantasia'), cnpj: fd.get('cnpj') } });
          toast('Empresa criada.');
          loadEmpresas();
        } catch (e) { toast(e.message, 'err'); }
      });
    } catch (e) { content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`; }
  }

  async function loadUsuarios() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const usuarios = await api('/usuarios');
      let empresas = [];
      if (hasPerfil('ADMIN')) empresas = await api('/empresas');
      
      const empOpts = empresas.map(e => `<option value="${e.id_empresa}">${escapeHtml(e.nome_fantasia)}</option>`).join('');
      const perfilOpts = hasPerfil('ADMIN') 
        ? `<option value="EMPRESA_ADMIN">Admin da Empresa</option>
           <option value="TECNICO">Técnico Terceirizado</option>
           <option value="SOLICITANTE">Solicitante Comum</option>`
        : `<option value="SOLICITANTE">Solicitante Comum</option>`;

      content.innerHTML = `
        <div class="card form-panel">
          <form id="form-novo-usuario" class="form-stack">
            <div class="grid-2">
              <label class="field"><span>Nome Completo</span><input name="nome_usuario" required /></label>
              <label class="field"><span>E-mail (Login)</span><input type="email" name="email" required /></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Senha Inicial</span><input type="password" name="senha" required minlength="6" /></label>
              <label class="field"><span>Cargo</span><input name="cargo" placeholder="Ex: Financeiro" /></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Perfil</span><select name="perfil_codigo" required>${perfilOpts}</select></label>
              ${hasPerfil('ADMIN') ? `<label class="field"><span>Empresa</span><select name="id_empresa" required><option value="">Selecione...</option>${empOpts}</select></label>` : ''}
            </div>
            <button type="submit" class="btn btn-primary">Criar Usuário</button>
          </form>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Empresa</th><th>Perfis</th></tr></thead>
            <tbody>
              ${usuarios.map(u => `<tr><td data-label="Nome">${escapeHtml(u.nome_usuario)}</td><td data-label="E-mail">${escapeHtml(u.email)}</td><td data-label="Cargo">${escapeHtml(u.cargo)}</td><td data-label="Empresa">${escapeHtml(u.empresa)}</td><td data-label="Perfis">${(u.perfis || []).join(', ')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      $('#form-novo-usuario').addEventListener('submit', async ev => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const body = Object.fromEntries(fd.entries());
        try {
          await api('/usuarios', { method: 'POST', body });
          toast('Usuário criado com sucesso.');
          loadUsuarios();
        } catch (e) { toast(e.message, 'err'); }
      });
    } catch (e) { content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`; }
  }

  async function loadTecnicosList() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const tecnicos = await api('/tecnicos');
      const empresas = await api('/empresas');
      
      const empOpts = empresas.map(e => `<option value="${e.id_empresa}">${escapeHtml(e.nome_fantasia)}</option>`).join('');
      const tecOpts = tecnicos.map(t => `<option value="${t.id_tecnico}">${escapeHtml(t.nome_usuario)}</option>`).join('');

      content.innerHTML = `
        <div class="card form-panel">
          <h4 style="margin-top:0">Vincular Técnico à Empresa (Multi-tenant)</h4>
          <form id="form-vincular" class="form-stack">
            <div class="grid-2">
              <label class="field"><span>Técnico</span><select name="id_tecnico" required><option value="">Selecione...</option>${tecOpts}</select></label>
              <label class="field"><span>Empresa Atendida</span><select name="id_empresa" required><option value="">Selecione...</option>${empOpts}</select></label>
            </div>
            <button type="submit" class="btn btn-primary">Vincular</button>
          </form>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>ID</th><th>Técnico</th><th>E-mail</th><th>Empresas Atendidas</th></tr></thead>
            <tbody>
              ${tecnicos.map(t => `<tr><td data-label="ID">${t.id_tecnico}</td><td data-label="Técnico">${escapeHtml(t.nome_usuario)}</td><td data-label="E-mail">${escapeHtml(t.email)}</td><td data-label="Empresas">${(t.empresas || []).join(', ') || '<span class="muted">Nenhuma</span>'}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      $('#form-vincular').addEventListener('submit', async ev => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await api(`/tecnicos/${fd.get('id_tecnico')}/vincular`, { method: 'POST', body: { id_empresa: fd.get('id_empresa') } });
          toast('Vínculo criado.');
          loadTecnicosList();
        } catch (e) { toast(e.message, 'err'); }
      });
    } catch (e) { content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`; }
  }

  async function loadCatalogo() {
    const [categorias, prioridades, status] = await Promise.all([
      api('/categorias'),
      api('/prioridades'),
      api('/status'),
    ]);
    state.catalogo = { categorias, prioridades, status };
  }

  async function loadTecnicos() {
    state.tecnicos = await api('/tecnicos');
  }

  async function loadHardwareList() {
    state.hardware = await api('/inventario/hardware');
  }

  async function loadChamados() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      state.chamados = await api('/chamados');
      if (!state.chamados.length) {
        content.innerHTML =
          '<div class="empty-state">Nenhum chamado visível. Abra um novo chamado ou troque de usuário.</div>';
        return;
      }
      content.innerHTML = `
        <div class="table-wrap">
          <table class="data" id="tbl-chamados">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Solicitante</th>
                <th>Abertura</th>
                <th>Prazo SLA</th>
              </tr>
            </thead>
            <tbody>
              ${state.chamados
                .map(
                  (c) => `
                <tr data-id="${c.id_chamado}">
                  <td data-label="ID">${c.id_chamado}</td>
                  <td data-label="Título">${escapeHtml(c.titulo)}</td>
                  <td data-label="Status"><span class="${badgeClass(c.status_codigo)}">${escapeHtml(c.status_codigo)}</span></td>
                  <td data-label="Prioridade">${escapeHtml(c.prioridade)}</td>
                  <td data-label="Solicitante">${escapeHtml(c.solicitante)}</td>
                  <td data-label="Abertura">${formatDate(c.data_abertura)}</td>
                  <td data-label="Prazo SLA">${renderSLA(c.data_prazo_sla, c.status_codigo)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
      startSLAUpdater();

      $('#tbl-chamados').addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-id]');
        if (tr) openChamadoModal(parseInt(tr.dataset.id, 10));
      });
    } catch (e) {
      content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`;
    }
  }

  async function loadInventario() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      state.hardware = await api('/inventario/hardware');
      
      let formHtml = '';
      if (hasPerfil('ADMIN', 'TECNICO')) {
        const [tipos, fabricantes, empresas] = await Promise.all([
          api('/inventario/tipos'),
          api('/inventario/fabricantes'),
          api('/empresas')
        ]);
        
        const optTipos = tipos.map(t => `<option value="${t.id_tipo_hardware}">${escapeHtml(t.nome)}</option>`).join('');
        const optFabs = fabricantes.map(f => `<option value="${f.id_fabricante}">${escapeHtml(f.nome)}</option>`).join('');
        const optEmps = empresas.map(e => `<option value="${e.id_empresa}">${escapeHtml(e.nome_fantasia)}</option>`).join('');
        
        formHtml = `
          <div class="card form-panel">
            <h4 style="margin-top:0">Cadastrar Novo Patrimônio</h4>
            <form id="form-novo-hw" class="form-stack">
              <div class="grid-2">
                <label class="field"><span>Empresa</span><select name="id_empresa" required><option value="">Selecione...</option>${optEmps}</select></label>
                <label class="field"><span>Tipo</span><select name="id_tipo_hardware" required><option value="">Selecione...</option>${optTipos}</select></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Fabricante</span><select name="id_fabricante" required><option value="">Selecione...</option>${optFabs}</select></label>
                <label class="field"><span>Modelo</span><input name="modelo" required /></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Nº de Série</span><input name="numero_serie" /></label>
                <label class="field"><span>TAG Patrimônio</span><input name="patrimonio_tag" /></label>
              </div>
              <button type="submit" class="btn btn-primary">Cadastrar Hardware</button>
            </form>
          </div>
        `;
      }

      content.innerHTML = formHtml + `
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>ID</th>
                ${hasPerfil('ADMIN') ? '<th>Empresa</th>' : ''}
                <th>Tipo</th>
                <th>Fabricante</th>
                <th>Modelo</th>
                <th>Patrimônio</th>
                <th>Série</th>
                <th>Status</th>
                ${hasPerfil('ADMIN', 'TECNICO') ? '<th>Ações</th>' : ''}
              </tr>
            </thead>
            <tbody id="hw-tbody">
              ${state.hardware.map(h => `
                <tr>
                  <td data-label="ID">${h.id_hardware}</td>
                  ${hasPerfil('ADMIN') ? `<td data-label="Empresa">${escapeHtml(h.empresa)}</td>` : ''}
                  <td data-label="Tipo">${escapeHtml(h.tipo)}</td>
                  <td data-label="Fabricante">${escapeHtml(h.fabricante)}</td>
                  <td data-label="Modelo">${escapeHtml(h.modelo)}</td>
                  <td data-label="Patrimônio"><code>${escapeHtml(h.patrimonio_tag || '—')}</code></td>
                  <td data-label="Série" class="muted small">${escapeHtml(h.numero_serie || '—')}</td>
                  <td data-label="Status">${escapeHtml(h.status_patrimonio)}</td>
                  ${hasPerfil('ADMIN', 'TECNICO') ? `<td><button type="button" class="btn btn-sm btn-secondary btn-baixar" data-id="${h.id_hardware}">Baixar</button></td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table>
          ${state.hardware.length === 0 ? '<div class="empty-state">Nenhum equipamento listado.</div>' : ''}
        </div>`;
      
      if (hasPerfil('ADMIN', 'TECNICO')) {
        $('#form-novo-hw').addEventListener('submit', async ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const body = Object.fromEntries(fd.entries());
          try {
            await api('/inventario/hardware', { method: 'POST', body });
            toast('Hardware cadastrado.');
            loadInventario();
          } catch (e) { toast(e.message, 'err'); }
        });
        
        $$('.btn-baixar').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Deseja dar baixa neste hardware?')) return;
            try {
              await api(`/inventario/hardware/${btn.dataset.id}/baixar`, { method: 'POST' });
              toast('Hardware baixado com sucesso.');
              loadInventario();
            } catch(e) { toast(e.message, 'err'); }
          });
        });
      }
    } catch (e) {
      content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`;
    }
  }

  function renderNovoChamado() {
    const { categorias, prioridades } = state.catalogo;
    const hwOpts =
      '<option value="">— Nenhum vínculo de Hardware —</option>' +
      (state.hardware || []).map((h) => `<option value="${h.id_hardware}">#${h.id_hardware} ${escapeHtml(h.modelo)}</option>`).join('');
    
    $('#page-content').innerHTML = `
      <div class="card form-panel">
        <form id="form-novo-chamado" class="form-stack">
          <label class="field">
            <span>Título</span>
            <input name="titulo" required maxlength="200" placeholder="Resumo do problema" />
          </label>
          <label class="field">
            <span>Descrição</span>
            <textarea name="descricao" required rows="5" placeholder="Detalhes, passos, impacto…"></textarea>
          </label>
          <div class="grid-2">
            <label class="field">
              <span>Categoria</span>
              <select name="id_categoria" required>
                <option value="">Selecione…</option>
                ${categorias.map((c) => `<option value="${c.id_categoria}">${escapeHtml(c.nome)} (SLA ${c.sla_horas_padrao}h)</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span>Prioridade</span>
              <select name="id_prioridade" required>
                <option value="">Selecione…</option>
                ${prioridades.map((p) => `<option value="${p.id_prioridade}">${escapeHtml(p.nome)} (×${p.fator_sla})</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid-2">
            <label class="field">
              <span>Hardware relacionado (opcional)</span>
              <select name="id_hardware_rel">${hwOpts}</select>
            </label>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Abrir chamado</button>
          </div>
        </form>
      </div>`;
    $('#form-novo-chamado').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const body = {
        titulo: fd.get('titulo'),
        descricao: fd.get('descricao'),
        id_categoria: Number(fd.get('id_categoria')),
        id_prioridade: Number(fd.get('id_prioridade')),
        id_hardware_rel: fd.get('id_hardware_rel') ? Number(fd.get('id_hardware_rel')) : null,
      };
      try {
        const r = await api('/chamados', { method: 'POST', body });
        toast(`Chamado #${r.id_chamado} criado.`);
        ev.target.reset();
        navigate('chamados');
      } catch (e) {
        toast(e.message, 'err');
      }
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function openChamadoModal(id) {
    const overlay = $('#modal-overlay');
    const body = $('#modal-body');
    const title = $('#modal-title');
    overlay.hidden = false;
    body.innerHTML = '<p class="muted">Carregando…</p>';
    title.textContent = `Chamado #${id}`;
    try {
      await loadTecnicos();
      const data = await api(`/chamados/${id}`);
      const c = data.chamado;
      const canTech = hasPerfil('ADMIN', 'TECNICO');
      const fechadoOuResolvido = ['FECHADO', 'RESOLVIDO'].includes(c.status_codigo);
      const podeAtuar = canTech && !fechadoOuResolvido;

      const tecOpts = state.tecnicos
        .map((t) => `<option value="${t.id_tecnico}">#${t.id_tecnico} ${escapeHtml(t.nome_usuario)}</option>`)
        .join('');

      body.innerHTML = `
        <dl class="detail-grid">
          <div class="detail-item"><dt>Status</dt><dd><span class="${badgeClass(c.status_codigo)}">${escapeHtml(c.status_codigo)}</span></dd></div>
          <div class="detail-item"><dt>Prioridade</dt><dd>${escapeHtml(c.prioridade)}</dd></div>
          <div class="detail-item"><dt>Categoria</dt><dd>${escapeHtml(c.categoria)}</dd></div>
          <div class="detail-item"><dt>Solicitante</dt><dd>${escapeHtml(c.solicitante_nome)}</dd></div>
          <div class="detail-item"><dt>Técnico</dt><dd>${escapeHtml(c.tecnico_nome || '—')}</dd></div>
          <div class="detail-item"><dt>Abertura</dt><dd>${formatDate(c.data_abertura)}</dd></div>
          <div class="detail-item"><dt>SLA / Prazo</dt><dd>${renderSLA(c.data_prazo_sla, c.status_codigo)}</dd></div>
          <div class="detail-item"><dt>Resolução</dt><dd>${formatDate(c.data_resolucao)}</dd></div>
          <div class="detail-item"><dt>Fechamento</dt><dd>${formatDate(c.data_fechamento)}</dd></div>
        </dl>
        <h4 class="muted small" style="margin:0 0 0.5rem">Descrição</h4>
        <div class="ticket-content">${escapeHtml(c.descricao)}</div>
        ${c.solucao ? `<h4 class="muted small" style="margin:0 0 0.5rem">Solução</h4><div class="ticket-content">${escapeHtml(c.solucao)}</div>` : ''}

        <div class="action-panel" style="display:flex; flex-direction:column; gap:2rem; margin-bottom:2rem; margin-top:1.5rem; padding-top:1.5rem; border-top:1px dashed var(--border)">
          <div>
            <button type="button" class="btn btn-secondary" id="btn-ver-nota"><span class="material-symbols-outlined" style="font-size: 1.2rem">receipt_long</span> Ver Nota Fiscal (Recibo)</button>
          </div>
          ${
            hasPerfil('ADMIN') && podeAtuar
              ? `<form id="form-atribuir" class="form-stack">
            <label class="field">
              <span>Atribuir técnico</span>
              <select name="id_tecnico" required>${tecOpts}</select>
            </label>
            <div><button type="submit" class="btn btn-primary">Atribuir</button></div>
          </form>`
              : (hasPerfil('TECNICO') && podeAtuar && !c.tecnico_nome ? `<div><button type="button" class="btn btn-primary" id="btn-assumir-chamado">Assumir Chamado</button></div>` : '')
          }
          ${
            podeAtuar
              ? `<form id="form-resolver" class="form-stack">
            <label class="field">
              <span>Registrar resolução</span>
              <textarea name="solucao" rows="3" required placeholder="Descreva a solução aplicada"></textarea>
            </label>
            <div><button type="submit" class="btn btn-primary">Marcar resolvido</button></div>
          </form>`
              : ''
          }
          ${
            c.status_codigo === 'RESOLVIDO'
              ? `<div><button type="button" class="btn btn-primary" id="btn-fechar-chamado">Fechar chamado</button></div>`
              : ''
          }
        </div>

        <h4 class="muted small" style="margin:0 0 0.75rem">Histórico</h4>
        <div class="timeline">
          ${data.historico
            .map(
              (h) => `
            <div class="timeline-item">
              <time>${formatDate(h.created_at || h.criado_em)}</time>
              <span class="muted small"> · ${escapeHtml(h.tipo_evento)}${h.autor_nome ? ` · ${escapeHtml(h.autor_nome)}` : ''}</span>
              <p class="${h.tipo_evento === 'ATRIBUICAO' ? 'highlight-msg' : ''}">${escapeHtml(h.mensagem)}</p>
            </div>`
            )
            .join('')}
        </div>`;
      
      startSLAUpdater();

      $('#btn-ver-nota')?.addEventListener('click', () => {
        openNotaFiscal(c);
      });

      $('#form-atribuir')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await api(`/chamados/${id}/atribuir`, {
            method: 'POST',
            body: { id_tecnico: Number(fd.get('id_tecnico')) },
          });
          toast('Técnico atribuído.');
          openChamadoModal(id);
          loadChamados();
        } catch (e) {
          toast(e.message, 'err');
        }
      });

      $('#btn-assumir-chamado')?.addEventListener('click', async () => {
        try {
          await api(`/chamados/${id}/atribuir`, { method: 'POST', body: {} });
          toast('Você assumiu este chamado.');
          openChamadoModal(id);
          loadChamados();
        } catch (e) {
          toast(e.message, 'err');
        }
      });

      $('#form-resolver')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await api(`/chamados/${id}/resolver`, {
            method: 'POST',
            body: { solucao: fd.get('solucao') },
          });
          toast('Resolução registrada.');
          openChamadoModal(id);
          loadChamados();
        } catch (e) {
          toast(e.message, 'err');
        }
      });

      $('#btn-fechar-chamado')?.addEventListener('click', async () => {
        try {
          await api(`/chamados/${id}/fechar`, { method: 'POST', body: {} });
          toast('Chamado fechado.');
          overlay.hidden = true;
          loadChamados();
        } catch (e) {
          toast(e.message, 'err');
        }
      });

    } catch (e) {
      body.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`;
    }
  }

  function openNotaFiscal(c) {
    const overlay = $('#modal-overlay');
    const body = $('#modal-body');
    const title = $('#modal-title');
    title.textContent = `Nota Fiscal - Chamado #${c.id_chamado}`;
    
    body.innerHTML = `
      <div id="nota-fiscal-render" class="nota-fiscal-container">
        <h4>RECIBO DE ATENDIMENTO</h4>
        <div class="nota-item"><span>CHAMADO:</span> <span>#${c.id_chamado}</span></div>
        <div class="nota-item"><span>DATA:</span> <span>${formatDate(c.data_abertura)}</span></div>
        <div class="nota-item"><span>CLIENTE:</span> <span>${escapeHtml(c.solicitante_nome)}</span></div>
        <div class="nota-item"><span>EMPRESA:</span> <span>${escapeHtml(c.empresa || state.user.empresa || 'SGDB')}</span></div>
        <div class="nota-divider"></div>
        <div class="nota-item"><span>TÍTULO:</span></div>
        <p style="margin: 0.5rem 0 1rem; font-weight:bold">${escapeHtml(c.titulo)}</p>
        <div class="nota-item"><span>CATEGORIA:</span> <span>${escapeHtml(c.categoria)}</span></div>
        <div class="nota-item"><span>PRIORIDADE:</span> <span>${escapeHtml(c.prioridade)}</span></div>
        <div class="nota-divider"></div>
        <div class="nota-item"><span>TÉCNICO:</span> <span>${escapeHtml(c.tecnico_nome || 'N/A')}</span></div>
        <div class="nota-item"><span>STATUS:</span> <span>${escapeHtml(c.status_codigo)}</span></div>
        <div class="nota-divider"></div>
        <div class="nota-footer">
          <p>SGDB - Service Desk & Ativos</p>
          <p>Sistema de Gestão de Chamados</p>
          <p>${new Date().toLocaleString()}</p>
        </div>
      </div>
      <div class="form-actions" style="justify-content:center; margin-top:1.5rem">
        <button type="button" class="btn btn-primary" id="btn-download-nota">Baixar como Imagem</button>
        <button type="button" class="btn btn-secondary" id="btn-voltar-modal">Voltar</button>
      </div>
    `;

    $('#btn-voltar-modal').addEventListener('click', () => openChamadoModal(c.id_chamado));
    $('#btn-download-nota').addEventListener('click', async () => {
      const el = $('#nota-fiscal-render');
      try {
        const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
        const link = document.createElement('a');
        link.download = `Nota_Chamado_${c.id_chamado}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast('Imagem gerada com sucesso.');
      } catch (e) {
        toast('Erro ao gerar imagem.', 'err');
      }
    });
  }

  function closeModal() {
    $('#modal-overlay').hidden = true;
  }

  async function initApp() {
    showScreen('app');
    setAvatar();
    renderNav();
    await navigate(state.page);
  }

  $('#form-login')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#login-error');
    err.hidden = true;
    const fd = new FormData(ev.target);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: fd.get('email'), senha: fd.get('senha') },
      });
      saveSession(data.token, data.usuario);
      await initApp();
    } catch (e) {
      err.textContent = e.message || 'Falha no login';
      err.hidden = false;
    }
  });

  $('#btn-logout')?.addEventListener('click', () => {
    clearSession();
    showScreen('login');
    state.page = 'chamados';
  });

  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  loadSession();
  if (state.token && state.user) {
    initApp().catch(() => {
      clearSession();
      showScreen('login');
    });
  } else {
    showScreen('login');
  }
})();
