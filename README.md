# SGDB - Service Desk & Controle de Ativos

![Status](https://img.shields.io/badge/Status-Concluído-success)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-blue)

Uma plataforma completa de Service Desk e Gestão de Ativos de Hardware focada em operações B2B (Multi-tenant). Desenvolvida com arquitetura robusta em Vanilla JS (Frontend) e Express + PostgreSQL (Backend).

## ✨ Principais Funcionalidades

- **Design Premium**: Interface responsiva e moderna inspirada no conceito de *Glassmorphism*, com foco em UX para times técnicos e paleta de cores para ambientes de baixa luminosidade (Dark Mode nativo).
- **SLA Real**: Contagem regressiva em tempo real. O SLA só é ativado quando um técnico de fato assume o chamado, evitando que o tempo corra enquanto o ticket aguarda na fila geral.
- **Recibos Virtuais (Nota Fiscal)**: Geração de recibos de atendimento detalhados em formato de cupom fiscal. O usuário pode baixar um PNG com todas as especificações do atendimento com apenas um clique.
- **Arquitetura Multi-Tenant**: Gestão de múltiplas empresas clientes simultaneamente. Cada usuário comum interage apenas com o ecossistema da sua empresa, enquanto o "Administrador Global" e Técnicos possuem visão ampla.
- **Gestão de Ativos (Inventário)**: Cadastro, rastreamento de tags patrimoniais e controle do ciclo de vida de hardwares atrelados aos chamados.
- **Histórico e Linha do Tempo**: Cada chamado possui uma *timeline* imutável que registra todas as alterações de status, troca de técnicos e mensagens.

## 📝 Fluxo de Abertura de Chamados

O sistema foi desenhado para evitar gargalos entre a abertura e o atendimento:

1. **Abertura Inteligente**: O usuário final acessa a plataforma, seleciona a Categoria do problema e a Prioridade (Crítica, Alta, Média, Baixa). O chamado nasce com o status **ABERTO**, mas *sem contagem de SLA*.
2. **Fila de Espera**: O chamado fica disponível para qualquer Técnico ou Administrador na fila da organização.
3. **Atribuição & Disparo de SLA**: Assim que um técnico "Assume o Chamado" (ou um admin o delega), o status muda para **EM_ATENDIMENTO**. O sistema calcula a data de expiração real (SLA) cruzando o peso da Categoria com a Prioridade escolhida, e o cronômetro começa a piscar em contagem regressiva para o técnico.
4. **Resolução**: O técnico registra a solução e marca o chamado como **RESOLVIDO**. O timer é congelado.
5. **Encerramento**: Após validação, o ticket é marcado como **FECHADO**.

## 📊 Gestão e Governança de Dados (SGBD)

Atendendo a rigorosos requisitos de confiabilidade e disponibilidade, a aplicação conta com recursos de nível NOC (Network Operations Center) focados na disciplina de Sistemas Gerenciadores de Banco de Dados:

- **Auditoria Global e Automática**: Middleware de interceptação que registra automaticamente toda e qualquer operação de criação, alteração ou exclusão (`POST`, `PUT`, `DELETE`) em todas as tabelas do sistema, garantindo rastreabilidade total de quem alterou o quê e quando.
- **Dashboard Cockpit**: Um painel de controle escuro e avançado que monitora métricas do PostgreSQL em tempo real, incluindo:
  - Cache Hit Ratio (Eficiência de memória RAM vs Disco).
  - Visibilidade de Queries (Histórico recente e comandos ativos).
  - Nível de Fragmentação (Alerta de *Dead Tuples* por tabela).
  - Gráfico de conexões ativas na instância.
- **Sistema Duplo de Backups Lógicos**: 
  - **Snapshot JSON**: Extração leve e puramente estruturada focada nos dados, ideal para auditorias e integrações via API.
  - **Raw SQL Dump**: Exportação massiva consolidando toda a DDL (Estrutura, Triggers, Views) e DML (Dados reais através de comandos `INSERT`), criando um script SQL perfeito para restauração nativa em qualquer instância PostgreSQL, ignorando dependências de PATH do S.O.

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
