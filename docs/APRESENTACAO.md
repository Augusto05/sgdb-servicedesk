# Plataforma Service Desk (Disciplina SGDB)

---

## 1. Visão Geral da Arquitetura (Multi-Tenant)
A arquitetura do sistema foi concebida nativamente sob o paradigma **Multi-Tenant** (Multilocatária), permitindo que uma única instância de banco de dados gerencie múltiplos clientes (Empresas) com isolamento lógico estrito.

* **Isolamento de Visão (Row-Level/Logic Security)**: A segregação de dados é garantida via backend e banco de dados. As *queries* aplicam invariavelmente cláusulas `WHERE` restritivas ao `id_empresa` atrelado ao contexto do usuário autenticado, impedindo vazamento de dados entre locatários (Cross-Tenant Data Leakage).
* **Visão Panorâmica Global**: Administradores Globais e Técnicos de Nível Superior (NOC) possuem capacidade de visualização e atuação trans-empresarial, mediada por relacionamentos *Many-to-Many* (`tecnico_empresa`), garantindo flexibilidade operacional sem comprometer a segurança.

## 2. Orquestração de Chamados e Controle de SLA
O pipeline de atendimento utiliza controle de concorrência e transações ACID para prevenir anomalias como *Lost Updates*, evitando que técnicos assumam tarefas concorrentes simultaneamente.

* **Transições de Estado Inteligentes**: O ticket é instanciado com o estado inicial **ABERTO**, congelando o cálculo de SLA até a efetiva triagem.
* **Mecanismos de Gatilho e SLA Dinâmico**: O relógio de SLA é acionado no exato momento da atribuição. O banco de dados invoca lógicas (via *Stored Procedures*) para calcular o *timestamp* de `data_prazo_sla`, parametrizado pelo nível de severidade/prioridade da ocorrência.
* **Auditoria Imutável (Event Sourcing Logging)**: Transições de estado disparam *triggers* que empilham logs na tabela `chamado_historico`. Trata-se de uma estrutura *Append-Only*, estabelecendo uma trilha de auditoria (*Audit Trail*) à prova de adulteração.

## 3. Gestão de Ativos (Configuration Management Database - CMDB)
A plataforma incorpora um micro-CMDB para rastreabilidade de infraestrutura e correlação de incidentes.
* **Integridade Relacional**: O esquema `inventario` unifica ativos de hardware e licenças de software, incluindo o tipo de hardware diretamente no registro para simplificação de consultas.
* **Mapeamento de Dependências**: A atribuição de ativos a usuários ou departamentos é fortemente tipada através de Chaves Estrangeiras (`FK`), assegurando a *Integridade Referencial* e impedindo a existência de ativos órfãos no sistema.

## 4. Governança e Monitoramento de SGBD (Foco do Projeto)
O grande diferencial técnico deste projeto é a implementação nativa de ferramentas de observabilidade, extração de dados e segurança, cobrindo os pilares fundamentais da disciplina de Banco de Dados.

### 4.1. Segurança (Autenticação e Criptografia)
* **RBAC (Role-Based Access Control)**: Controle de acesso granular definido por perfis (ADMIN, TECNICO, EMPRESA_ADMIN, USUARIO), restringindo o escopo de execução das APIs e consultas SQL.
* **Criptografia e Hardening**: Armazenamento de credenciais utilizando *Hashing* algorítmico com *Salt* (Bcrypt). Defesas ativas na camada de rede incluem *Rate Limiting* (mitigação de *Brute Force*) e políticas CSP (via Helmet) contra injeções XSS. Autorização *Stateless* viabilizada via tokens JWT.

### 4.2. Rotinas de Backup Dual (Alta Disponibilidade)
Para contornar limitações de variáveis de ambiente (*PATH*) em sistemas operacionais hospedeiros (como ausência do executável `pg_dump`), a aplicação implementa seu próprio **Motor Duplo de Extração (Backup Engine)**, executado sob demanda ou de forma automatizada:
* **Modo JSON (Snapshot Estruturado)**: Realiza uma serialização leve e estruturada das tabelas DML vitais (Empresas, Usuários, Chamados, Inventário) no formato JSON. Otimizado para integrações de API, migrações noSQL e auditorias rápidas.
* **Modo Raw SQL (DML/DDL Dump Nativo)**: Abstração completa da engenharia reversa do banco. O motor consome os arquivos DDL originais de infraestrutura (Schemas, Procedures, Triggers) e realiza *Full Table Scans* para gerar dinamicamente milhares de instruções `INSERT INTO` (DML). O output é um script `.sql` autossuficiente e *Drop-In*, capaz de reidratar completamente uma nova instância PostgreSQL do zero.

### 4.3. Monitoramento Avançado (Painel NOC / Cockpit DBA)
Um dos principais artefatos da disciplina é a transparência operacional. Foi desenvolvido um **Cockpit Administrativo** que atua como um supervisor da saúde da instância PostgreSQL, consumindo diretamente suas *System Catalogs* e *Dynamic Statistics Views*. O painel supervisiona ativamente:

* **Consumo de Armazenamento**: Utilização das funções `pg_database_size('sgdb')` em conjunto com `pg_size_pretty()` para formatar em tempo real a volumetria da base de dados.
* **Densidade de Conexões**: Contagem de *backends* (sessões) ativos na instância utilizando a view `pg_stat_activity`, medindo o esgotamento do pool de conexões.
* **Eficiência de Memória (Cache Hit Ratio)**: Cálculo heurístico acessando a view `pg_stat_database` (`sum(blks_hit) * 100 / nullif(sum(blks_hit + blks_read), 0)`). Este indicador supervisiona a proporção de blocos lidos da memória RAM (Shared Buffers) em relação às leituras físicas em disco (I/O).
* **Desfragmentação e Tuplas Mortas (Dead Tuples)**: Varredura da view `pg_stat_user_tables` para extrair o indicador `n_dead_tup`. O painel elenca o "Top 5" de tabelas mais fragmentadas (com alto volume de UPDATEs/DELETEs), servindo como alerta precoce para a necessidade de rotinas de `VACUUM` (Reclaim de espaço).
* **Visibilidade de Queries (Últimas Operações)**: Monitoramento da view `pg_stat_activity` que captura os PIDs, o texto da instrução SQL e a duração. O sistema exibe as operações mais recentes, permitindo auditar o que acabou de ser processado pelo motor do banco, mesmo em conexões que já entraram em estado de espera (*idle*).
* **Volume Operacional**: Contagem absoluta de registros transacionais (total de logs no sistema e total de chamados operados).

### 4.4. Telemetria e Auditoria Global Automática
A plataforma implementa um sistema de **Auditoria Passiva e Onipresente**:
* **Middleware de Interceptação**: Todas as operações mutantes (Criação, Atualização e Exclusão) são interceptadas por uma camada de middleware que registra automaticamente o autor, o módulo afetado, a URL da API e o corpo da requisição (quando aplicável) na tabela `sistema_log`.
* **Rastreabilidade Total**: Garante que 100% das alterações realizadas via aplicação sejam documentadas de forma imutável, permitindo a reconstituição de eventos e responsabilização (Accountability) em cenários de suporte ou segurança.

---
**Projeto de SGBD** - Uma prova de conceito que transcende o CRUD básico, entregando soluções reais de administração, resiliência de dados e monitoramento de performance em instâncias de banco de dados corporativas.
