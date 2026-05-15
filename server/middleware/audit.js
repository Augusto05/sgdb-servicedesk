const { sysLog } = require('../services/logger');

/**
 * Middleware de Auditoria Global
 * Intercepta requisições bem-sucedidas de mutação (POST, PUT, DELETE)
 * e registra automaticamente no log do sistema.
 */
function auditMiddleware(req, res, next) {
  // Somente métodos que alteram dados
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalJson = res.json;

    res.json = function(data) {
      // Registrar apenas se o status for sucesso (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Ignorar login para não logar dados sensíveis (o serviço de auth pode ter seu próprio log se necessário)
        if (req.originalUrl.includes('/auth/login')) return originalJson.call(this, data);

        const modulo = req.originalUrl.split('/')[2] || 'SYSTEM';
        const usuario = req.user?.nome || 'Sistema';
        const acao = req.method === 'POST' ? 'Criação' : (req.method === 'DELETE' ? 'Exclusão' : 'Atualização');
        
        sysLog('INFO', modulo.toUpperCase(), `${acao} via ${req.method} em ${req.originalUrl} por ${usuario}`, {
          metodo: req.method,
          url: req.originalUrl,
          corpo: req.method === 'DELETE' ? undefined : req.body,
          status: res.statusCode
        });
      }
      return originalJson.call(this, data);
    };
  }
  next();
}

module.exports = { auditMiddleware };
