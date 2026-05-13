const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('async function renderDbAdmin()')) {
  console.log('renderDbAdmin already exists.');
  process.exit(0);
}

const renderFunction = `
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
        return \`<span class="badge" style="background-color: \${colors[level] || '#555'}">\${level}</span>\`;
      };

      content.innerHTML = \`
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
          <div class="card" style="background: rgba(var(--primary-rgb), 0.05); border-left: 4px solid var(--primary);">
            <div class="muted small">Status da Conexão</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">\${escapeHtml(metrics.status)}</div>
          </div>
          <div class="card">
            <div class="muted small">Conexões Ativas</div>
            <div style="font-size: 1.5rem; font-weight: bold;">\${metrics.conexoes_ativas}</div>
          </div>
          <div class="card">
            <div class="muted small">Tamanho do BD</div>
            <div style="font-size: 1.5rem; font-weight: bold;">\${escapeHtml(metrics.tamanho)}</div>
          </div>
          <div class="card">
            <div class="muted small">Total de Chamados</div>
            <div style="font-size: 1.5rem; font-weight: bold;">\${metrics.total_chamados}</div>
          </div>
        </div>

        <div class="card form-panel" style="margin-bottom: 2rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h4 style="margin:0;">Gestão de Backups</h4>
            <button class="btn btn-primary btn-sm" id="btn-run-backup">Executar Backup Agora</button>
          </div>
          <p class="muted small">Último backup: \${metrics.ultimo_backup ? formatDate(metrics.ultimo_backup) : 'Nenhum'}</p>
          
          \${backups.length > 0 ? \`
            <table class="data" style="margin-top:1rem;">
              <thead><tr><th>Arquivo</th><th>Tamanho</th><th>Data</th><th>Ação</th></tr></thead>
              <tbody>
                \${backups.map(b => \`
                  <tr>
                    <td><code>\${escapeHtml(b.name)}</code></td>
                    <td>\${b.sizeMB} MB</td>
                    <td>\${formatDate(b.createdAt)}</td>
                    <td><a href="/api/db/backup/download/\${b.name}" target="_blank" class="btn btn-sm btn-secondary">Download</a></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \` : '<div class="empty-state">Nenhum backup encontrado na pasta.</div>'}
        </div>

        <h4 style="margin-bottom:1rem;">Logs do Sistema</h4>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nível</th><th>Módulo</th><th>Mensagem</th><th>Data/Hora</th></tr></thead>
            <tbody>
              \${logs.map(l => \`
                <tr>
                  <td>\${logLevelBadge(l.nivel)}</td>
                  <td><span class="muted small">\${escapeHtml(l.modulo)}</span></td>
                  <td>\${escapeHtml(l.mensagem)}</td>
                  <td>\${formatDate(l.criado_em)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
          \${logs.length === 0 ? '<div class="empty-state">Nenhum log registrado.</div>' : ''}
        </div>
      \`;

      $('#btn-run-backup')?.addEventListener('click', async () => {
        if (!confirm('Deseja iniciar um backup físico (pg_dump) agora? Isso pode consumir recursos do banco.')) return;
        const btn = $('#btn-run-backup');
        btn.disabled = true;
        btn.textContent = 'Gerando...';
        try {
          await api('/db/backup/trigger', { method: 'POST' });
          toast('Backup concluído com sucesso!');
          renderDbAdmin();
        } catch (e) {
          toast(e.message, 'err');
          btn.disabled = false;
          btn.textContent = 'Executar Backup Agora';
        }
      });

    } catch (e) {
      content.innerHTML = \`<p class="msg-error">\${escapeHtml(e.message)}</p>\`;
    }
  }

`;

const targetIndex = content.lastIndexOf('function escapeHtml(s) {');

if (targetIndex !== -1) {
  content = content.slice(0, targetIndex) + renderFunction + content.slice(targetIndex);
  fs.writeFileSync(filePath, content);
  console.log('Successfully injected renderDbAdmin.');
} else {
  console.log('Could not find injection point.');
}
