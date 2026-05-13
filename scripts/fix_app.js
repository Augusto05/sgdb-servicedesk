const fs = require('fs');
const path = 'c:\\Users\\bueno\\coding\\sgdb-project\\public\\js\\app.js';
let content = fs.readFileSync(path, 'utf8');

const newLoadInventario = `  async function loadInventario() {
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
        
        const optTipos = tipos.map(t => \`<option value="\${t.id_tipo_hardware}">\${escapeHtml(t.nome)}</option>\`).join('');
        const optFabs = fabricantes.map(f => \`<option value="\${f.id_fabricante}">\${escapeHtml(f.nome)}</option>\`).join('');
        const optEmps = empresas.map(e => \`<option value="\${e.id_empresa}">\${escapeHtml(e.nome_fantasia)}</option>\`).join('');
        
        formHtml = \`
          <div class="card form-panel">
            <h4 style="margin-top:0">Cadastrar Novo Item no Inventário</h4>
            <form id="form-novo-inv" class="form-stack">
              <div class="grid-2">
                <label class="field"><span>Empresa</span><select name="id_empresa" required><option value="">Selecione...</option>\${optEmps}</select></label>
                <label class="field"><span>Categoria do Item</span><select name="tipo_item" id="sel-tipo-inv" required><option value="HARDWARE">Hardware</option><option value="SOFTWARE">Software</option></select></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Fabricante</span><select name="id_fabricante" required><option value="">Selecione...</option>\${optFabs}</select></label>
                <label class="field"><span>Nome/Modelo</span><input name="nome_modelo" required /></label>
              </div>
              <!-- Hardware Fields -->
              <div class="grid-2 hw-fields">
                <label class="field"><span>Tipo de Hardware</span><select name="id_tipo_hardware"><option value="">Selecione...</option>\${optTipos}</select></label>
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
        \`;
      }

      content.innerHTML = formHtml + \`
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>ID</th>
                \${hasPerfil('ADMIN') ? '<th>Empresa</th>' : ''}
                <th>Tipo</th>
                <th>Fabricante</th>
                <th>Nome/Modelo</th>
                <th>Detalhes (Tag/Série/Versão)</th>
                <th>Status</th>
                \${hasPerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN') ? '<th>Ações</th>' : ''}
              </tr>
            </thead>
            <tbody id="hw-tbody">
              \${state.inventario.map(h => \`
                <tr>
                  <td data-label="ID">\${h.id_inventario}</td>
                  \${hasPerfil('ADMIN') ? \`<td data-label="Empresa">\${escapeHtml(h.empresa)}</td>\` : ''}
                  <td data-label="Tipo"><span class="badge \${h.tipo_item === 'HARDWARE' ? 'badge-hardware' : 'badge-software'}">\${escapeHtml(h.tipo_item)}</span></td>
                  <td data-label="Fabricante">\${escapeHtml(h.fabricante)}</td>
                  <td data-label="Nome/Modelo">\${escapeHtml(h.nome_modelo)}</td>
                  <td data-label="Detalhes" class="muted small">\${escapeHtml(h.tipo_item === 'HARDWARE' ? (h.patrimonio_tag || h.numero_serie || '—') : (h.versao || '—'))}</td>
                  <td data-label="Status">\${escapeHtml(h.status)}</td>
                  \${hasPerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN') ? \`<td><button type="button" class="btn btn-sm btn-secondary btn-del-inv" data-id="\${h.id_inventario}">Deletar</button></td>\` : ''}
                </tr>\`).join('')}
            </tbody>
          </table>
          \${state.inventario.length === 0 ? '<div class="empty-state">Nenhum equipamento listado.</div>' : ''}
        </div>\`;
      
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
              await api(\`/inventario/\${btn.dataset.id}\`, { method: 'DELETE' });
              toast('Item deletado com sucesso.');
              loadInventario();
            } catch(e) { toast(e.message, 'err'); }
          });
        });
      }
    } catch (e) {
      content.innerHTML = \`<p class="msg-error">\${escapeHtml(e.message)}</p>\`;
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
      content.innerHTML = \`
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Chamado</th><th>Técnico</th><th>Novo Prazo</th><th>Motivo</th><th>Ações</th></tr></thead>
            <tbody>
              \${requests.map(s => \`
                <tr>
                  <td>#\${s.id_chamado} - \${escapeHtml(s.chamado_titulo)}</td>
                  <td>\${escapeHtml(s.tecnico_nome)}</td>
                  <td>\${formatDate(s.nova_data_prazo)}</td>
                  <td>\${escapeHtml(s.motivo)}</td>
                  <td>
                    <button class="btn btn-sm btn-primary btn-app-sla" data-id="\${s.id_solicitacao}" data-approved="true">Aprovar</button>
                    <button class="btn btn-sm btn-secondary btn-app-sla" data-id="\${s.id_solicitacao}" data-approved="false">Rejeitar</button>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>\`;
      
      $$('.btn-app-sla').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const approved = btn.dataset.approved === 'true';
        const motivo = prompt(\`Motivo da \${approved ? 'aprovação' : 'rejeição'}:\`);
        if (motivo === null) return;
        try {
          await api(\`/chamados/solicitacoes-sla/\${id}/responder\`, { method: 'POST', body: { aprovado: approved, motivo_resposta: motivo } });
          toast(\`Solicitação \${approved ? 'aprovada' : 'rejeitada'}.\`);
          loadSlaRequests();
        } catch (e) { toast(e.message, 'err'); }
      }));
    } catch (e) {
      content.innerHTML = \`<p class="msg-error">\${escapeHtml(e.message)}</p>\`;
    }
  }
`;

// Replace from line 475 start to function openChamadoModal start
const startSearch = 'async function loadInventario() {';
const endSearch = 'async function openChamadoModal(id) {';

const startIndex = content.indexOf(startSearch);
const endIndex = content.indexOf(endSearch);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newLoadInventario + "\n\n" + content.substring(endIndex);
  fs.writeFileSync(path, content);
  console.log('Success');
} else {
  console.log('Failure: start=' + startIndex + ', end=' + endIndex);
}
