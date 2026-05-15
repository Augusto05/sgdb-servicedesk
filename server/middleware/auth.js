const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  if (req.user) return next();
  
  let token;
  const header = req.headers.authorization;
  
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ erro: 'Token ausente.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

function requirePerfil(...codigos) {
  return [
    authRequired,
    (req, res, next) => {
      const perfis = req.user?.perfis || [];
      if (!codigos.some((c) => perfis.includes(c))) {
        return res.status(403).json({ erro: 'Permissão insuficiente.' });
      }
      return next();
    }
  ];
}

module.exports = { authRequired, requirePerfil };
