const fs = require('fs');

let code = fs.readFileSync('public/js/app.js', 'utf8');

// Replace loadInventario
code = code.replace(/async function loadInventario\(\) \{[\s\S]*?async function loadPecas\(\) \{/, `async function loadInventario() {
    const content = $('#page-content');
    content.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const [hardware, software] = await Promise.all([
        api('/inventario/hardware'),
        api('/inventario/software')
      ]);
      state.hardware = hardware;
      state.software = software;
      
      let formHtml = '';
      if (hasPerfil('ADMIN', 'TECNICO')) {
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
            <h4 style="margin-top:0">Cadastrar Novo Patrimônio (Hardware / Software)</h4>
            
            <div class="tabs" style="display:flex; gap:1rem; margin-bottom:1rem;">
              <button type="button" class="btn btn-sm btn-primary" id="tab-btn-hw">Novo Hardware</button>
              <button type="button" class="btn btn-sm btn-secondary" id="tab-btn-sw">Novo Software</button>
            </div>

            <form id="form-novo-hw" class="form-stack">
              <div class="grid-2">
                <label class="field"><span>Empresa</span><select name="id_empresa" required><option value="">Selecione...</option>\${optEmps}</select></label>
                <label class="field"><span>Tipo</span><select name="id_tipo_hardware" required><option value="">Selecione...</option>\${optTipos}</select></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Fabricante</span><select name="id_fabricante" required><option value="">Selecione...</option>\${optFabs}</select></label>
                <label class="field"><span>Modelo</span><input name="modelo" required /></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Nº de Série</span><input name="numero_serie" /></label>
                <label class="field"><span>TAG Patrimônio</span><input name="patrimonio_tag" /></label>
              </div>
              <button type="submit" class="btn btn-primary">Cadastrar Hardware</button>
            </form>

            <form id="form-novo-sw" class="form-stack" style="display:none;">
              <div class="grid-2">
                <label class="field"><span>Empresa</span><select name="id_empresa" required><option value="">Selecione...</option>\${optEmps}</select></label>
                <label class="field"><span>Fabricante</span><select name="id_fabricante" required><option value="">Selecione...</option>\${optFabs}</select></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Nome do Software</span><input name="nome" required /></label>
                <label class="field"><span>Versão</span><input name="versao" /></label>
              </div>
              <div class="grid-2">
                <label class="field"><span>Chave de Licença</span><input name="chave_licenca" /></label>
                <label class="field"><span>Data de Expiração</span><input type="date" name="data_expiracao" /></label>
              </div>
              <button type="submit" class="btn btn-primary">Cadastrar Software</button>
            </form>

          </div>
        \`;
      }

      content.innerHTML = formHtml + \`
        <div style="display:flex; flex-direction:column; gap: 2rem;">
          <div class="table-wrap">
            <h4>Hardware</h4>
            <table class="data">
              <thead>
                <tr>
                  <th>ID</th>
                  \${hasPerfil('ADMIN') ? '<th>Empresa</th>' : ''}
                  <th>Tipo</th>
                  <th>Fabricante</th>
                  <th>Modelo</th>
                  <th>Patrimônio / Série</th>
                  \${hasPerfil('ADMIN', 'TECNICO') ? '<th>Ações</th>' : ''}
                </tr>
              </thead>
              <tbody>
                \${state.hardware.map(h => \`
                  <tr>
                    <td>\${h.id_hardware}</td>
                    \${hasPerfil('ADMIN') ? \`<td>\${escapeHtml(h.empresa)}</td>\` : ''}
                    <td>\${escapeHtml(h.tipo)}</td>
                    <td>\${escapeHtml(h.fabricante)}</td>
                    <td>\${escapeHtml(h.modelo)}</td>
                    <td>\${escapeHtml(h.patrimonio_tag || '—')} / \${escapeHtml(h.numero_serie || '—')}</td>
                    \${hasPerfil('ADMIN', 'TECNICO') ? \`<td><button type="button" class="btn btn-sm btn-secondary btn-baixar-hw" data-id="\${h.id_hardware}">Baixar</button></td>\` : ''}
                  </tr>\`).join('')}
              </tbody>
            </table>
            \${state.hardware.length === 0 ? '<div class="empty-state">Nenhum hardware listado.</div>' : ''}
          </div>

          <div class="table-wrap">
            <h4>Software</h4>
            <table class="data">
              <thead>
                <tr>
                  <th>ID</th>
                  \${hasPerfil('ADMIN') ? '<th>Empresa</th>' : ''}
                  <th>Fabricante</th>
                  <th>Nome</th>
                  <th>Versão</th>
                  <th>Licença / Expiração</th>
                </tr>
              </thead>
              <tbody>
                \${state.software.map(s => \`
                  <tr>
                    <td>\${s.id_software}</td>
                    \${hasPerfil('ADMIN') ? \`<td>\${escapeHtml(s.empresa)}</td>\` : ''}
                    <td>\${escapeHtml(s.fabricante)}</td>
                    <td>\${escapeHtml(s.nome)}</td>
                    <td>\${escapeHtml(s.versao || '—')}</td>
                    <td>\${escapeHtml(s.chave_licenca || '—')} <br> \${s.data_expiracao ? formatDate(s.data_expiracao) : ''}</td>
                  </tr>\`).join('')}
              </tbody>
            </table>
            \${state.software.length === 0 ? '<div class="empty-state">Nenhum software listado.</div>' : ''}
          </div>
        </div>\`;
      
      if (hasPerfil('ADMIN', 'TECNICO')) {
        $('#tab-btn-hw').addEventListener('click', e => {
          e.target.className = 'btn btn-sm btn-primary';
          $('#tab-btn-sw').className = 'btn btn-sm btn-secondary';
          $('#form-novo-hw').style.display = 'flex';
          $('#form-novo-sw').style.display = 'none';
        });
        $('#tab-btn-sw').addEventListener('click', e => {
          e.target.className = 'btn btn-sm btn-primary';
          $('#tab-btn-hw').className = 'btn btn-sm btn-secondary';
          $('#form-novo-sw').style.display = 'flex';
          $('#form-novo-hw').style.display = 'none';
        });

        $('#form-novo-hw').addEventListener('submit', async ev => {
          ev.preventDefault();
          const body = Object.fromEntries(new FormData(ev.target).entries());
          try {
            await api('/inventario/hardware', { method: 'POST', body });
            toast('Hardware cadastrado.');
            loadInventario();
          } catch (e) { toast(e.message, 'err'); }
        });

        $('#form-novo-sw').addEventListener('submit', async ev => {
          ev.preventDefault();
          const body = Object.fromEntries(new FormData(ev.target).entries());
          if(!body.data_expiracao) delete body.data_expiracao;
          try {
            await api('/inventario/software', { method: 'POST', body });
            toast('Software cadastrado.');
            loadInventario();
          } catch (e) { toast(e.message, 'err'); }
        });
        
        $$('.btn-baixar-hw').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Deseja dar baixa neste hardware?')) return;
            try {
              await api(\`/inventario/hardware/\${btn.dataset.id}/baixar\`, { method: 'POST' });
              toast('Hardware baixado com sucesso.');
              loadInventario();
            } catch(e) { toast(e.message, 'err'); }
          });
        });
      }
    } catch (e) {
      content.innerHTML = \`<p class="msg-error">\${escapeHtml(e.message)}</p>\`;
    }
  }

  async function loadPecas() {`);


// Replace renderNovoChamado
code = code.replace(/function renderNovoChamado\(\) \{[\s\S]*?function renderEstoque\(\) \{/, `function renderNovoChamado() {
    const { categorias, prioridades } = state.catalogo;
    const hwOpts =
      '<option value="">— Nenhum vínculo de Hardware —</option>' +
      (state.hardware || []).map((h) => \`<option value="\${h.id_hardware}">#\${h.id_hardware} \${escapeHtml(h.modelo)}</option>\`).join('');
    const swOpts =
      '<option value="">— Nenhum vínculo de Software —</option>' +
      (state.software || []).map((s) => \`<option value="\${s.id_software}">#\${s.id_software} \${escapeHtml(s.nome)}</option>\`).join('');
      
    $('#page-content').innerHTML = \`
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
                \${categorias.map((c) => \`<option value="\${c.id_categoria}">\${escapeHtml(c.nome)} (SLA \${c.sla_horas_padrao}h)</option>\`).join('')}
              </select>
            </label>
            <label class="field">
              <span>Prioridade</span>
              <select name="id_prioridade" required>
                <option value="">Selecione…</option>
                \${prioridades.map((p) => \`<option value="\${p.id_prioridade}">\${escapeHtml(p.nome)} (×\${p.fator_sla})</option>\`).join('')}
              </select>
            </label>
          </div>
          <div class="grid-2">
            <label class="field">
              <span>Hardware relacionado (opcional)</span>
              <select name="id_hardware_rel">\${hwOpts}</select>
            </label>
            <label class="field">
              <span>Software relacionado (opcional)</span>
              <select name="id_software_rel">\${swOpts}</select>
            </label>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Abrir chamado</button>
          </div>
        </form>
      </div>\`;
    $('#form-novo-chamado').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const body = {
        titulo: fd.get('titulo'),
        descricao: fd.get('descricao'),
        id_categoria: Number(fd.get('id_categoria')),
        id_prioridade: Number(fd.get('id_prioridade')),
        id_hardware_rel: fd.get('id_hardware_rel') ? Number(fd.get('id_hardware_rel')) : null,
        id_software_rel: fd.get('id_software_rel') ? Number(fd.get('id_software_rel')) : null,
      };
      try {
        const r = await api('/chamados', { method: 'POST', body });
        toast(\`Chamado #\${r.id_chamado} criado.\`);
        ev.target.reset();
        navigate('chamados');
      } catch (e) {
        toast(e.message, 'err');
      }
    });
  }

  function renderEstoque() {`);


// Replace openChamadoModal assignment logic
code = code.replace(/<div class="toolbar" style="margin-bottom:1\.25rem; flex-wrap:wrap">[\s\S]*?<h4 class="muted small" style="margin:0 0 0\.75rem">Histórico<\/h4>/, `<div class="toolbar" style="margin-bottom:1.25rem; flex-wrap:wrap">
          \${
            hasPerfil('ADMIN') && podeAtuar
              ? \`<form id="form-atribuir" class="toolbar" style="gap:0.5rem; align-items:flex-end">
            <label class="field" style="margin:0; min-width:200px">
              <span>Atribuir técnico</span>
              <select name="id_tecnico" required>\${tecOpts}</select>
            </label>
            <button type="submit" class="btn btn-secondary">Atribuir</button>
          </form>\`
              : (hasPerfil('TECNICO') && podeAtuar && !c.tecnico_nome ? \`<button type="button" class="btn btn-secondary" id="btn-assumir-chamado">Assumir Chamado</button>\` : '')
          }
          \${
            podeAtuar
              ? \`<form id="form-resolver" class="form-stack" style="flex:1; min-width:220px">
            <label class="field">
              <span>Registrar resolução</span>
              <textarea name="solucao" rows="3" required placeholder="Descreva a solução aplicada"></textarea>
            </label>
            <button type="submit" class="btn btn-primary btn-sm">Marcar resolvido</button>
          </form>\`
              : ''
          }
          \${
            c.status_codigo === 'RESOLVIDO'
              ? \`<button type="button" class="btn btn-primary" id="btn-fechar-chamado">Fechar chamado</button>\`
              : ''
          }
        </div>

        <h4 class="muted small" style="margin:0 0 0.75rem">Histórico</h4>`);

// Add listener for Assumir
code = code.replace(/toast\('Técnico atribuído\.'\);[\s\S]*?\}\);[\s\S]*?\$\('#form-resolver'\)\?\.addEventListener/, `toast('Técnico atribuído.');
          openChamadoModal(id);
          loadChamados();
        } catch (e) {
          toast(e.message, 'err');
        }
      });

      $('#btn-assumir-chamado')?.addEventListener('click', async () => {
        try {
          await api(\`/chamados/\${id}/atribuir\`, { method: 'POST', body: {} });
          toast('Você assumiu este chamado.');
          openChamadoModal(id);
          loadChamados();
        } catch (e) {
          toast(e.message, 'err');
        }
      });

      $('#form-resolver')?.addEventListener`);


// Make history highlight Assumir messages
code = code.replace(/<p>\$\{escapeHtml\(h\.mensagem\)\}<\/p>/g, `<p class="\${h.tipo_evento === 'ATRIBUICAO' ? 'highlight-msg' : ''}">\${escapeHtml(h.mensagem)}</p>`);


fs.writeFileSync('public/js/app.js', code);
fs.appendFileSync('public/index.css', `
.highlight-msg {
  color: #0d9488;
  font-weight: 500;
  background: #ccfbf1;
  padding: 0.5rem;
  border-radius: 4px;
}
`);
