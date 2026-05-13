require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const chamadosRoutes = require('./routes/chamados');
const catalogoRoutes = require('./routes/catalogo');
const inventoryRoutes = require('./routes/inventory');
const empresasRoutes = require('./routes/empresas');
const usuariosRoutes = require('./routes/usuarios');
const tecnicosRoutes = require('./routes/tecnicos');

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('Defina DATABASE_URL e JWT_SECRET no arquivo .env');
  process.exit(1);
}

const app = express();

/**
 * Configuração de Segurança (Helmet & CORS)
 * Helmet adiciona cabeçalhos HTTP que protegem o app de vulnerabilidades conhecidas da web.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        'connect-src': ["'self'"],
        'style-src': ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        'font-src': ["'self'", "https://fonts.gstatic.com"],
      },
    },
  })
);
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '64kb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/**
 * Rate Limiting (Proteção contra força bruta e DDoS)
 * Limita cada IP a 300 requisições a cada 15 minutos na API de forma global,
 * e limita requisições no endpoint de login a 30 por 15 minutos.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { erro: 'Muitas tentativas de login. Aguarde.' },
});
app.use('/api/auth/login', loginLimiter);

app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * Rotas da Aplicação (API Restful)
 * Organizadas por domínio da aplicação (Autenticação, Chamados, Inventário, etc.)
 */
const dbAdminRoutes = require('./routes/db_admin');

app.use('/api/auth', authRoutes);
app.use('/api/chamados', chamadosRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/tecnicos', tecnicosRoutes);
app.use('/api/db', dbAdminRoutes);
app.use('/api', catalogoRoutes);
app.use('/api', inventoryRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`SGDB API em http://localhost:${port}`);
});
