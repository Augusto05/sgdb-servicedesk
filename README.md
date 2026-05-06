# SGDB - Service Desk & Ativos

![Status](https://img.shields.io/badge/Status-Concluído-success)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-blue)

Uma plataforma completa de Service Desk e Gestão de Ativos de Hardware focada em operações B2B (Multi-tenant). Desenvolvida com arquitetura robusta em Vanilla JS (Frontend) e Express + PostgreSQL (Backend).

## ✨ Principais Funcionalidades

- **Design Premium**: Interface responsiva e moderna inspirada no conceito de *Glassmorphism*, com foco em UX para times técnicos.
- **SLA Real**: Contagem regressiva em tempo real. O SLA só é ativado quando um técnico de fato assume o chamado.
- **Recibos Virtuais (Nota Fiscal)**: Geração de recibos de atendimento detalhados em formato de cupom fiscal com exportação para imagem com um clique (via `html2canvas`).
- **Arquitetura Multi-Tenant**: Gestão de múltiplas empresas clientes simultaneamente, onde cada usuário só acessa chamados de sua organização e técnicos visualizam todas sob sua responsabilidade.
- **Gestão de Ativos**: Cadastro, rastreamento de tags patrimoniais e controle do ciclo de vida de hardwares atrelados aos chamados.

## 🛠️ Stack Tecnológica

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Material Symbols.
- **Backend**: Node.js, Express, Helmet (Security), CORS.
- **Banco de Dados**: PostgreSQL com lógica de negócios nativa através de *Stored Procedures* (PL/pgSQL).

## 🚀 Como Executar o Projeto

Existem duas formas principais de iniciar o projeto: utilizando Docker ou de forma nativa.

### Opção 1: Via Docker (Recomendado)

Requer [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado.

1. Clone este repositório.
2. Inicie os serviços (isso subirá o banco PostgreSQL na porta 5432):
   ```bash
   npm run docker:up
   ```
3. Inicialize as tabelas e usuários do banco:
   ```bash
   npm run docker:bootstrap
   ```
4. Inicie o servidor da API:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:3000`.

### Opção 2: Local / Nativo

Requer [Node.js](https://nodejs.org/) e PostgreSQL instalados localmente.

1. No PostgreSQL local, crie o banco de dados `sgdb`.
2. Configure o arquivo `.env` na raiz do projeto conforme o modelo em `.env.example`.
3. Aplique os scripts da pasta `/sql` sequencialmente no banco `sgdb` (`01_schema.sql`, `02_functions.sql`, etc).
4. Instale as dependências:
   ```bash
   npm install
   ```
5. Rode a aplicação:
   ```bash
   npm run dev
   ```

## 🔒 Segurança
- O projeto ignora arquivos `.env` ou logs via `.gitignore`.
- Conta com proteção Anti-DDoS e Force-Brute nos endpoints de login (`express-rate-limit`).
- Diretivas restritas de *Content Security Policy* (`helmet`).

---
Desenvolvido para gerenciamento inteligente e ágil de suporte corporativo.
