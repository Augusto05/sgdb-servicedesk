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

  window.toggleInvFields = (val) => {
    document.querySelectorAll('.hw-fields').forEach(el => el.style.display = val === 'HARDWARE' ? 'grid' : 'none');
    document.querySelectorAll('.sw-fields').forEach(el => el.style.display = val === 'SOFTWARE' ? 'grid' : 'none');
  };

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
    if (hasPerfil('ADMIN')) {
      items.push({ id: 'sla_pedidos', label: 'Solicitações SLA', icon: 'notification_important' });
      items.push({ id: 'db_admin', label: 'Painel BD', icon: 'database' });
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
      await loadInventarioList();
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
    } else if (page === 'sla_pedidos') {
      title.textContent = 'Solicitações de Mudança de SLA';
      await loadSlaRequests();
    } else if (page === 'db_admin') {
      title.textContent = 'Painel de Banco de Dados';
      actions.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-db">Atualizar</button>';
      $('#btn-refresh-db')?.addEventListener('click', () => renderDbAdmin());
      await renderDbAdmin();
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
            <thead><tr><th>ID</th><th>Empresa</th><th>CNPJ</th><th>Criado em</th><th>Ações</th></tr></thead>
            <tbody>
              ${empresas.map(e => `<tr><td data-label="ID">${e.id_empresa}</td><td data-label="Empresa">${escapeHtml(e.nome_fantasia)}</td><td data-label="CNPJ">${escapeHtml(e.cnpj)}</td><td data-label="Criado em">${formatDate(e.criado_em)}</td><td><button type="button" class="btn btn-sm btn-secondary btn-del-emp" data-id="${e.id_empresa}">Excluir</button></td></tr>`).join('')}
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
      $$('.btn-del-emp').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Deseja excluir esta empresa?')) return;
        try {
          await api(`/empresas/${btn.dataset.id}`, { method: 'DELETE' });
          toast('Empresa excluída.');
          loadEmpresas();
        } catch (e) { toast(e.message, 'err'); }
      }));
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
              <label class="field"><span>Foto (URL)</span><input name="foto_url" placeholder="https://..." /></label>
              <label class="field"><span>Data Nascimento</span><input type="date" name="data_nascimento" /></label>
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
            <thead><tr><th>Nome</th><th>E-mail</th><th>Empresa</th><th>Perfis</th><th>Ações</th></tr></thead>
            <tbody>
              ${usuarios.map(u => `<tr><td data-label="Nome">${escapeHtml(u.nome_usuario)}</td><td data-label="E-mail">${escapeHtml(u.email)}</td><td data-label="Empresa">${escapeHtml(u.empresa)}</td><td data-label="Perfis">${(u.perfis || []).join(', ')}</td><td><button type="button" class="btn btn-sm btn-secondary btn-del-user" data-id="${u.id_usuario}">Excluir</button></td></tr>`).join('')}
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
      $$('.btn-del-user').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Deseja excluir este usuário?')) return;
        try {
          await api(`/usuarios/${btn.dataset.id}`, { method: 'DELETE' });
          toast('Usuário excluído.');
          loadUsuarios();
        } catch (e) { toast(e.message, 'err'); }
      }));
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
            <thead><tr><th>ID</th><th>Técnico</th><th>E-mail</th><th>Empresas Atendidas</th><th>Ações</th></tr></thead>
            <tbody>
              ${tecnicos.map(t => `<tr><td data-label="ID">${t.id_tecnico}</td><td data-label="Técnico">${escapeHtml(t.nome_usuario)}</td><td data-label="E-mail">${escapeHtml(t.email)}</td><td data-label="Empresas">${(t.empresas || []).join(', ') || '<span class="muted">Nenhuma</span>'}</td><td><button type="button" class="btn btn-sm btn-secondary btn-del-tec" data-id="${t.id_tecnico}">Excluir</button></td></tr>`).join('')}
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
      $$('.btn-del-tec').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Deseja excluir este técnico? (Isso não apaga o usuário, apenas seu perfil técnico e vínculos)')) return;
        try {
          await api(`/tecnicos/${btn.dataset.id}`, { method: 'DELETE' });
          toast('Técnico excluído.');
          loadTecnicosList();
        } catch (e) { toast(e.message, 'err'); }
      }));
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

  async function loadInventarioList() {
    state.inventario = await api('/inventario');
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
      state.inventario = await api('/inventario');
      
      let formHtml = '';
      if (hasPerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN')) {
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
            <h4 style="margin-top:0">Cadastrar Novo Item no Inventário</h4>
            <form id="form-novo-inv" class="form-stack">
              <div class="grid-2">
                <label class="field"><span>Empresa</span><select name="id_empresa" required><option value="">Selecione...</option>${optEmps}</select></label>
                <label class="field"><span>Categoria do Item</span><select name="tipo_item" id="sel-tipo-inv" required><option value="HARDWARE">Hardware</option><option value="SOFTWARE">Software</option></select></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Fabricante</span><select name="id_fabricante" required><option value="">Selecione...</option>${optFabs}</select></label>
                <label class="field"><span>Nome/Modelo</span><input name="nome_modelo" required /></label>
              </div>
              <!-- Hardware Fields -->
              <div class="grid-2 hw-fields">
                <label class="field"><span>Tipo de Hardware</span><select name="id_tipo_hardware"><option value="">Selecione...</option>${optTipos}</select></label>
                <label class="field"><span>TAG Patrimônio</span><input name="patrimonio_tag" /></label>
              </div>
              <div class="grid-2 hw-fields">
                <label class="field"><span>Nº de Série</span><input name="numero_serie" /></label>
                <label class="field"><span>Data Aquisição</span><input type="date" name="data_aquisicao" /></label>
              </div>
              <!-- Software Fields -->
              <div class="grid-2 sw-fields" style="display:none">
                <label class="field"><span>Versão</span><input name="versao" /></label>
                <label class="field"><span>Chave de Licença</span><input name="chave_licenca" /></label>
              </div>
              <div class="grid-2 sw-fields" style="display:none">
                <label class="field"><span>Data Expiração</span><input type="date" name="data_expiracao" /></label>
              </div>
              
              <button type="submit" class="btn btn-primary">Cadastrar Item</button>
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
                <th>Nome/Modelo</th>
                <th>Detalhes (Tag/Série/Versão)</th>
                <th>Status</th>
                ${hasPerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN') ? '<th>Ações</th>' : ''}
              </tr>
            </thead>
            <tbody id="hw-tbody">
              ${state.inventario.map(h => `
                <tr>
                  <td data-label="ID">${h.id_inventario}</td>
                  ${hasPerfil('ADMIN') ? `<td data-label="Empresa">${escapeHtml(h.empresa)}</td>` : ''}
                  <td data-label="Tipo"><span class="badge ${h.tipo_item === 'HARDWARE' ? 'badge-hardware' : 'badge-software'}">${escapeHtml(h.tipo_item)}</span></td>
                  <td data-label="Fabricante">${escapeHtml(h.fabricante)}</td>
                  <td data-label="Nome/Modelo">${escapeHtml(h.nome_modelo)}</td>
                  <td data-label="Detalhes" class="muted small">${escapeHtml(h.tipo_item === 'HARDWARE' ? (h.patrimonio_tag || h.numero_serie || '—') : (h.versao || '—'))}</td>
                  <td data-label="Status">${escapeHtml(h.status)}</td>
                  ${hasPerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN') ? `<td><button type="button" class="btn btn-sm btn-secondary btn-del-inv" data-id="${h.id_inventario}">Deletar</button></td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table>
          ${state.inventario.length === 0 ? '<div class="empty-state">Nenhum equipamento listado.</div>' : ''}
        </div>`;
      
      if (hasPerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN')) {
        $('#sel-tipo-inv')?.addEventListener('change', (e) => toggleInvFields(e.target.value));
        toggleInvFields($('#sel-tipo-inv')?.value || 'HARDWARE');

        $('#form-novo-inv')?.addEventListener('submit', async ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const body = Object.fromEntries(fd.entries());
          Object.keys(body).forEach(k => { if (body[k] === '') delete body[k]; });
          
          try {
            await api('/inventario', { method: 'POST', body });
            toast('Item cadastrado.');
            loadInventario();
          } catch (e) { toast(e.message, 'err'); }
        });
        
        $$('.btn-del-inv').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Deseja deletar este item do inventário?')) return;
            try {
              await api(`/inventario/${btn.dataset.id}`, { method: 'DELETE' });
              toast('Item deletado com sucesso.');
              loadInventario();
            } catch(e) { toast(e.message, 'err'); }
          });
        });
      }
    } catch (e) {
      content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`;
    }
  }

  async function loadSlaRequests() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const requests = await api('/chamados/solicitacoes-sla');
      if (requests.length === 0) {
        content.innerHTML = '<div class="empty-state">Nenhuma solicitação pendente.</div>';
        return;
      }
      content.innerHTML = `
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Chamado</th><th>Técnico</th><th>Novo Prazo</th><th>Motivo</th><th>Ações</th></tr></thead>
            <tbody>
              ${requests.map(s => `
                <tr>
                  <td>#${s.id_chamado} - ${escapeHtml(s.chamado_titulo)}</td>
                  <td>${escapeHtml(s.tecnico_nome)}</td>
                  <td>${formatDate(s.nova_data_prazo)}</td>
                  <td>${escapeHtml(s.motivo)}</td>
                  <td>
                    <button class="btn btn-sm btn-primary btn-app-sla" data-id="${s.id_solicitacao}" data-approved="true">Aprovar</button>
                    <button class="btn btn-sm btn-secondary btn-app-sla" data-id="${s.id_solicitacao}" data-approved="false">Rejeitar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
      
      $$('.btn-app-sla').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const approved = btn.dataset.approved === 'true';
        const motivo = prompt(`Motivo da ${approved ? 'aprovação' : 'rejeição'}:`);
        if (motivo === null) return;
        try {
          await api(`/chamados/solicitacoes-sla/${id}/responder`, { method: 'POST', body: { aprovado: approved, motivo_resposta: motivo } });
          toast(`Solicitação ${approved ? 'aprovada' : 'rejeitada'}.`);
          loadSlaRequests();
        } catch (e) { toast(e.message, 'err'); }
      }));
    } catch (e) {
      content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`;
    }
  }


  function renderNovoChamado() {
    const { categorias, prioridades } = state.catalogo;
    const invOpts =
      '<option value="">— Nenhum item do inventário —</option>' +
      (state.inventario || []).map((h) => `<option value="${h.id_inventario}">[${h.tipo_item === 'HARDWARE' ? 'HW' : 'SW'}] #${h.id_inventario} ${escapeHtml(h.nome_modelo)}</option>`).join('');
    
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
              <span>Item de Inventário relacionado (opcional)</span>
              <select name="id_inventario">${invOpts}</select>
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
        id_inventario: fd.get('id_inventario') ? Number(fd.get('id_inventario')) : null,
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
        .map((t) => `<option value="${t.id_tecnico}">#${t.id_tecnico} ${escapeHtml(t.nome_usuario)}\</option>`)
        .join('');

      // Helper function to render ID Card
      const renderIDCard = (name, role, emp, foto, nasc) => {
        const age = nasc ? Math.floor((new Date() - new Date(nasc).getTime()) / 3.15576e+10) : 'N/A';
        const photoUrl = foto || 'https://via.placeholder.com/64?text=' + name.charAt(0);
        return `<div class="id-card-popup">
          <div class="id-card-header"></div>
          <div class="id-card-body">
            <img src="${photoUrl}" alt="${escapeHtml(name)}" class="id-card-photo" />
            <div class="id-card-info">
              <strong>${escapeHtml(name)}</strong>
              <span class="muted small">${role}</span>
              <span class="muted small">Empresa: ${escapeHtml(emp || 'N/A')}</span>
              <span class="muted small">Idade: ${age}</span>
            </div>
          </div>
        </div>`;
      };

      body.innerHTML = `
        <dl class="detail-grid">
          <div class="detail-item"><dt>Status</dt><dd><span class="${badgeClass(c.status_codigo)}">${escapeHtml(c.status_codigo)}</span></dd></div>
          <div class="detail-item"><dt>Prioridade</dt><dd>${escapeHtml(c.prioridade)}</dd></div>
          <div class="detail-item"><dt>Categoria</dt><dd>${escapeHtml(c.categoria)}</dd></div>
          <div class="detail-item has-popup">
            <dt>Solicitante</dt>
            <dd class="popup-trigger">${escapeHtml(c.solicitante_nome)}
              ${renderIDCard(c.solicitante_nome, 'Solicitante', c.solicitante_empresa_nome, c.solicitante_foto, c.solicitante_nasc)}
            </dd>
          </div>
          <div class="detail-item has-popup">
            <dt>Técnico</dt>
            <dd class="popup-trigger">${escapeHtml(c.tecnico_nome || '—')}
              ${c.tecnico_nome ? renderIDCard(c.tecnico_nome, 'Técnico', c.tecnico_empresa_nome, c.tecnico_foto, c.tecnico_nasc) : ''}
            </dd>
          </div>
          <div class="detail-item"><dt>Abertura</dt><dd>${formatDate(c.data_abertura)}</dd></div>
          <div class="detail-item"><dt>SLA / Prazo</dt><dd>${renderSLA(c.data_prazo_sla, c.status_codigo)}</dd></div>
          <div class="detail-item"><dt>Item</dt><dd>${c.inventario_nome ? `[${c.inventario_tipo === 'HARDWARE' ? 'HW' : 'SW'}] ${escapeHtml(c.inventario_nome)}` : '—'}</dd></div>
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
        </div>
        
        ${podeAtuar ? `
        <div class="action-panel" style="margin-top:2rem; padding-top:1.5rem; border-top:1px dashed var(--border)">
          <h4 class="muted small" style="margin-bottom:1rem">Ações do Técnico</h4>
          
          <form id="form-add-hist" class="form-stack" style="margin-bottom:1.5rem">
            <label class="field">
              <span>Adicionar Registro ao Histórico</span>
              <textarea name="mensagem" required rows="2" placeholder="Tentativa de contato, análise, etc."></textarea>
            </label>
            <div class="grid-2">
              <label class="field">
                <span>Tipo do Evento</span>
                <select name="tipo_evento">
                  <option value="COMENTARIO">Comentário</option>
                  <option value="TENTATIVA_CONTATO">Tentativa de Contato</option>
                  <option value="ANALISE">Análise Técnica</option>
                  <option value="IMPEDIMENTO">Impedimento/Bloqueio</option>
                </select>
              </label>
              <div style="display:flex; align-items:flex-end;">
                <button type="submit" class="btn btn-secondary">Adicionar</button>
              </div>
            </div>
          </form>

          ${hasPerfil('TECNICO') && !hasPerfil('ADMIN') ? `
          <form id="form-req-sla" class="form-stack">
            <label class="field">
              <span>Solicitar Mudança de SLA</span>
            </label>
            <div class="grid-2">
              <label class="field">
                <span>Novo Prazo</span>
                <input type="datetime-local" name="nova_data_prazo" required />
              </label>
              <label class="field">
                <span>Motivo</span>
                <input name="motivo" required placeholder="Justificativa" />
              </label>
            </div>
            <div><button type="submit" class="btn btn-secondary">Solicitar</button></div>
          </form>` : ''}
        </div>
        ` : ''}
        `;
      
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
      
      $('#form-add-hist')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await api(`/chamados/${id}/historico`, {
            method: 'POST',
            body: { mensagem: fd.get('mensagem'), tipo_evento: fd.get('tipo_evento') },
          });
          toast('Registro adicionado.');
          openChamadoModal(id);
        } catch (e) {
          toast(e.message, 'err');
        }
      });

      $('#form-req-sla')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          const dateStr = fd.get('nova_data_prazo') + ':00.000Z'; // basic ISO conversion
          await api(`/chamados/${id}/solicitar-sla`, {
            method: 'POST',
            body: { nova_data_prazo: new Date(fd.get('nova_data_prazo')).toISOString(), motivo: fd.get('motivo') },
          });
          toast('Solicitação enviada.');
          openChamadoModal(id);
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
  
  async function renderDbAdmin() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando métricas do BD…</p>';
    try {
      const [metrics, logs, backups] = await Promise.all([
        api('/db/metrics'),
        api('/db/logs'),
        api('/db/backups')
      ]);

      const logLevelBadge = (level) => {
        const colors = { INFO: 'blue', WARN: 'orange', ERROR: 'red', CRITICAL: 'darkred' };
        return `<span class="badge" style="background-color: ${colors[level] || '#555'}">${level}</span>`;
      };

      // Prepare chart data
      const maxConn = 100; 
      const activeConn = parseInt(metrics.conexoes_ativas) || 0;
      
      content.innerHTML = `
        <style>
          .db-dashboard {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            margin-top: 1rem;
            color: #e2e8f0;
          }
          .db-row {
            display: flex;
            gap: 1.5rem;
            flex-wrap: wrap;
          }
          .db-kpi-card {
            flex: 1;
            min-width: 200px;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .db-kpi-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8;
            margin-bottom: 0.5rem;
            font-weight: 700;
          }
          .db-kpi-value {
            font-size: 2.2rem;
            font-weight: 800;
            color: #f8fafc;
          }
          .db-panel {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
          }
          .db-panel-title {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0 0 1rem 0;
            color: #f8fafc;
            font-size: 1.1rem;
          }
          .db-col-main { flex: 3; min-width: 60%; display: flex; flex-direction: column; gap: 1.5rem; }
          .db-col-side { flex: 1; min-width: 300px; display: flex; flex-direction: column; gap: 1.5rem; }
          .db-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; font-family: monospace; }
          .db-table th { padding: 0.75rem; border-bottom: 1px solid #334155; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
          .db-table td { padding: 0.75rem; border-bottom: 1px solid #334155; color: #cbd5e1; }
          .db-table tr:hover { background: rgba(255,255,255,0.02); }
        </style>

        <div class="db-dashboard">
          <!-- KPIs Row -->
          <div class="db-row">
            <div class="db-kpi-card" style="border-top: 4px solid #10b981;">
              <div class="db-kpi-title">Status</div>
              <div class="db-kpi-value" style="color: #10b981;">${escapeHtml(metrics.status)}</div>
            </div>
            <div class="db-kpi-card" style="border-top: 4px solid #3b82f6;">
              <div class="db-kpi-title">Cache Hit Ratio</div>
              <div class="db-kpi-value">${escapeHtml(metrics.cache_hit_ratio)}%</div>
            </div>
            <div class="db-kpi-card" style="border-top: 4px solid #8b5cf6;">
              <div class="db-kpi-title">Tamanho do BD</div>
              <div class="db-kpi-value">${escapeHtml(metrics.tamanho)}</div>
            </div>
            <div class="db-kpi-card" style="border-top: 4px solid #f59e0b;">
              <div class="db-kpi-title">Conexões Ativas</div>
              <div class="db-kpi-value">${metrics.conexoes_ativas}</div>
            </div>
          </div>

          <!-- Main Layout -->
          <div class="db-row">
            <!-- Coluna Principal -->
            <div class="db-col-main">
              <div class="db-row" style="gap:1.5rem;">
                <div class="db-panel" style="flex: 1; align-items: center;">
                  <h4 class="db-panel-title" style="align-self: flex-start;"><span class="material-symbols-outlined">data_usage</span> Conexões (Uso)</h4>
                  <div style="width: 200px; height: 200px; position: relative;">
                    <canvas id="chart-connections"></canvas>
                  </div>
                </div>
                
                <div class="db-panel" style="flex: 2;">
                  <h4 class="db-panel-title"><span class="material-symbols-outlined">warning</span> Alertas de Desempenho (Dead Tuples)</h4>
                  ${(metrics.dead_tuples || []).length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem;">
                      ${metrics.dead_tuples.map(dt => `
                        <div>
                          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.85rem;">
                            <span style="color:#cbd5e1; font-family:monospace;">${escapeHtml(dt.relname)}</span>
                            <span style="color: #ef4444; font-weight:bold;">${dt.n_dead_tup} tuplas mortas</span>
                          </div>
                          <div style="width: 100%; background: #0f172a; height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid #334155;">
                            <div style="width: ${Math.min((dt.n_dead_tup / 100) * 100, 100)}%; background: #ef4444; height: 100%; box-shadow: 0 0 10px #ef4444;"></div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  ` : '<p style="color:#94a3b8; font-size:0.9rem;">Nenhuma tabela com alta fragmentação.</p>'}
                </div>
              </div>

              <!-- Top Queries -->
              <div class="db-panel">
                <h4 class="db-panel-title"><span class="material-symbols-outlined">speed</span> Últimas Queries (pg_stat_activity)</h4>
                <div style="overflow-x: auto;">
                  <table class="db-table">
                    <thead><tr><th>PID</th><th>Status</th><th>Duração</th><th>Query Executada</th></tr></thead>
                    <tbody>
                      ${(metrics.ultimas_queries || []).map(q => `
                        <tr>
                          <td>${q.pid}</td>
                          <td><span class="badge" style="background: ${q.state === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}; color: ${q.state === 'active' ? '#34d399' : '#fbbf24'};">${escapeHtml(q.state)}</span></td>
                          <td><strong style="color:#f8fafc;">${parseFloat(q.duration).toFixed(3)}s</strong></td>
                          <td style="max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(q.query)}">${escapeHtml(q.query)}</td>
                        </tr>
                      `).join('')}
                      ${!(metrics.ultimas_queries?.length) ? '<tr><td colspan="4" style="text-align:center; color:#64748b;">Nenhuma query ativa capturada no momento.</td></tr>' : ''}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Logs -->
              <div class="db-panel">
                <h4 class="db-panel-title"><span class="material-symbols-outlined">receipt_long</span> System Logs (Auditoria)</h4>
                <div style="max-height: 250px; overflow-y: auto;">
                  <table class="db-table">
                    <thead style="position: sticky; top: 0; background: #1e293b; z-index: 1;">
                      <tr><th>Nível</th><th>Módulo</th><th>Mensagem</th><th>Data/Hora</th></tr>
                    </thead>
                    <tbody>
                      ${logs.map(l => `
                        <tr>
                          <td>${logLevelBadge(l.nivel)}</td>
                          <td style="font-weight: 600; color:#cbd5e1;">${escapeHtml(l.modulo)}</td>
                          <td style="color:#94a3b8;">${escapeHtml(l.mensagem)}</td>
                          <td style="white-space: nowrap;">${formatDate(l.criado_em)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Coluna Lateral -->
            <div class="db-col-side">
              <div class="db-panel" style="background: linear-gradient(180deg, #1e293b, #0f172a); border-color: #3b82f6;">
                <h4 class="db-panel-title" style="color: #60a5fa;"><span class="material-symbols-outlined">cloud_download</span> Backup Management</h4>
                <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem;">
                  Escolha entre extração estruturada (JSON) para integrações rápidas, ou SQL nativo contendo toda a DDL/DML.
                </p>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  <button class="btn btn-primary" id="btn-run-backup-json" style="width: 100%; justify-content: center; padding: 0.85rem; font-size: 0.95rem; border-radius: 8px; background: #3b82f6; color: #fff;">
                    <span class="material-symbols-outlined" style="font-size: 1.2rem;">data_object</span> Gerar JSON Snapshot
                  </button>
                  <button class="btn btn-primary" id="btn-run-backup-sql" style="width: 100%; justify-content: center; padding: 0.85rem; font-size: 0.95rem; border-radius: 8px; background: #10b981; color: #fff;">
                    <span class="material-symbols-outlined" style="font-size: 1.2rem;">terminal</span> Gerar Raw SQL Dump
                  </button>
                </div>
                
                <div style="margin-top: 2rem;">
                  <h5 style="font-size: 0.8rem; text-transform: uppercase; color: #64748b; margin-bottom: 0.75rem;">Snapshots Disponíveis</h5>
                  ${backups.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 350px; overflow-y: auto;">
                      ${backups.map(b => {
                        const isSql = b.name.endsWith('.sql');
                        const iconColor = isSql ? '#10b981' : '#3b82f6';
                        const icon = isSql ? 'terminal' : 'data_object';
                        return `
                          <div style="background: rgba(0,0,0,0.2); border: 1px solid #334155; border-radius: 8px; padding: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                              <span class="material-symbols-outlined" style="color: ${iconColor}; font-size: 1.5rem;">${icon}</span>
                              <div style="overflow: hidden;">
                                <div style="font-family: monospace; font-size: 0.75rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</div>
                                <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.25rem;">${b.sizeMB} MB • ${formatDate(b.createdAt)}</div>
                              </div>
                            </div>
                            <a href="/api/db/backup/download/${b.name}" target="_blank" class="btn btn-icon" title="Baixar" style="color: ${iconColor}; margin-left: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 6px;">
                              <span class="material-symbols-outlined">download</span>
                            </a>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : '<div style="font-size:0.85rem; color:#64748b;">Nenhum backup encontrado.</div>'}
                </div>
              </div>

              <div class="db-panel">
                 <h4 class="db-panel-title"><span class="material-symbols-outlined">memory</span> Instância</h4>
                 <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem; line-height: 2; color: #cbd5e1;">
                   <li style="display:flex; justify-content:space-between;"><span>Engine:</span> <strong>PostgreSQL 16</strong></li>
                   <li style="display:flex; justify-content:space-between;"><span>Runtime:</span> <strong>Node.js 18.x</strong></li>
                   <li style="display:flex; justify-content:space-between;"><span>Registros:</span> <strong>${metrics.total_chamados}</strong></li>
                   <li style="display:flex; justify-content:space-between;"><span>Porta Ativa:</span> <strong>5432</strong></li>
                 </ul>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Renderizar o Chart.js com segurança
      setTimeout(() => {
        if (window.Chart) {
          const canvas = document.getElementById('chart-connections');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
              type: 'doughnut',
              data: {
                labels: ['Ativas', 'Livres'],
                datasets: [{
                  data: [activeConn, Math.max(maxConn - activeConn, 0)],
                  backgroundColor: ['#f59e0b', '#334155'],
                  borderWidth: 0
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false }, tooltip: { enabled: true } }
              }
            });
          }
        } else {
          console.error("Chart.js não está disponível no window.");
        }
      }, 100);

      $('#btn-run-backup-json')?.addEventListener('click', async () => {
        if (!confirm('Deseja iniciar um backup estruturado em formato JSON?')) return;
        const btn = $('#btn-run-backup-json');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined">sync</span> Gerando...';
        try {
          await api('/db/backup/trigger', { method: 'POST' });
          toast('Backup JSON concluído com sucesso!');
          renderDbAdmin();
        } catch (e) {
          toast(e.message, 'err');
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined">data_object</span> Gerar JSON Snapshot';
        }
      });

      $('#btn-run-backup-sql')?.addEventListener('click', async () => {
        if (!confirm('Deseja iniciar um Raw SQL Dump? (Estrutura e Dados)')) return;
        const btn = $('#btn-run-backup-sql');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined">sync</span> Gerando...';
        try {
          await api('/db/backup/sql/trigger', { method: 'POST' });
          toast('Raw SQL Dump concluído com sucesso!');
          renderDbAdmin();
        } catch (e) {
          toast(e.message, 'err');
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined">terminal</span> Gerar Raw SQL Dump';
        }
      });

    } catch (e) {
      content.innerHTML = `<p class="msg-error">${escapeHtml(e.message)}</p>`;
    }
  }

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
