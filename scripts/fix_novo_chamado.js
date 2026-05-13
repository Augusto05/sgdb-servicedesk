const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = 'async function openChamadoModal(id) {';

if (content.includes('function renderNovoChamado() {')) {
  console.log('renderNovoChamado already exists!');
  process.exit(0);
}

const functionCode = `  function renderNovoChamado() {
    const { categorias, prioridades } = state.catalogo;
    const invOpts =
      '<option value="">— Nenhum item do inventário —</option>' +
      (state.inventario || []).map((h) => \`<option value="\${h.id_inventario}">[\${h.tipo_item === 'HARDWARE' ? 'HW' : 'SW'}] #\${h.id_inventario} \${escapeHtml(h.nome_modelo)}</option>\`).join('');
    
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
              <span>Item de Inventário relacionado (opcional)</span>
              <select name="id_inventario">\${invOpts}</select>
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
        id_inventario: fd.get('id_inventario') ? Number(fd.get('id_inventario')) : null,
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

  `;

const index = content.indexOf(targetStr);
if (index !== -1) {
  content = content.slice(0, index) + functionCode + content.slice(index);
  fs.writeFileSync(filePath, content);
  console.log('Successfully injected renderNovoChamado.');
} else {
  console.log('Could not find target string.');
}
