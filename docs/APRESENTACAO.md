# Roteiro de Apresentação: SGDB - Service Desk & Banco de Dados

Bem-vindo à apresentação técnica do **SGDB**, projetado não apenas como um sistema de Service Desk, mas como uma prova de conceito de governança, segurança e alta disponibilidade exigidas na disciplina de **Sistemas Gerenciadores de Banco de Dados (SGBD)**.

---

## 1. Visão Geral da Arquitetura (Multi-Tenant)
O SGDB foi concebido nativamente como uma plataforma **Multi-Tenant** (Multilocatária). 
Isso significa que uma única instalação (uma única base de dados) pode gerenciar diversas "Empresas" (clientes) simultaneamente, com isolamento lógico de dados.

* **Isolamento de Visão**: Garantido via banco de dados e backend. As consultas (Queries) sempre forçam cláusulas `WHERE` vinculando as entidades ao `id_empresa` do usuário autenticado. Um usuário de suporte da "Empresa A" jamais verá os chamados ou o inventário da "Empresa B".
* **Visão Panorâmica (Global)**: O Administrador Global e os Técnicos de TI conseguem visualizar, filtrar e atuar nos chamados de *todas* as empresas às quais foram explicitamente vinculados através da tabela de relacionamento `tecnico_empresa`.

## 2. Central de Chamados (Help Desk) & Controle de SLA
A fila de tickets utiliza transações (ACID) para garantir que a concorrência não permita que dois técnicos assumam o mesmo chamado simultaneamente.

* **Abertura Inteligente**: O chamado nasce com o status **ABERTO**, mas *sem contagem de SLA*.
* **SLA Baseado em Triggers/Lógica**: O cronômetro de prazo máximo só é disparado no exato momento em que o técnico assume a responsabilidade. O banco utiliza uma *Stored Procedure* (`sp_atribuir_tecnico`) ou uma rota segura que atualiza o `id_tecnico` e calcula a data de expiração (`data_prazo_sla`) com base no nível de prioridade cadastrado.
* **Timeline (Log de Eventos)**: Toda vez que o status do chamado muda, um gatilho/serviço empilha um evento na tabela `chamado_historico`. Essa tabela é apêndice apenas (insert-only), construindo uma trilha de auditoria imutável.

## 3. Gestão de Ativos (Inventário Unificado)
Tão importante quanto resolver problemas é saber *onde* eles estão acontecendo.
* **Modelo Entidade-Relacionamento**: A tabela `inventario` consolida equipamentos de hardware e software através de *constraints* (restrições de domínio).
* **Vínculo Empregatício**: Todo hardware pode ser atribuído a uma Pessoa (Usuário) ou a um Departamento. Chaves Estrangeiras (`FK_usuario_inventario`) asseguram a integridade referencial.

## 4. Pilares de SGBD (O Diferencial do Projeto)
Este projeto destaca a aplicação de três pilares fundamentais da disciplina de Banco de Dados: **Segurança, Confiabilidade e Monitoramento**.

### 4.1. Segurança (Auth & Proteção de Dados)
* **Controle de Acesso Baseado em Perfis (RBAC)**: O esquema define quatro papéis (ADMIN, TECNICO, EMPRESA_ADMIN, USUARIO) limitando acessos em nível de API e de consultas SQL.
* **Proteção Cibernética**: O sistema utiliza *Hash* com *Salt* (Bcrypt) para as senhas no banco, inviabilizando roubo de credenciais em caso de vazamento. A API utiliza *Rate Limit* para mitigar ataques de Força Bruta e *Helmet* (CSP) para prevenir injeção de scripts (XSS). O acesso é via token assinado digitalmente (JWT).

### 4.2. Confiabilidade e Backup (Disponibilidade)
* **Rotina de Snapshots e Dual Backup**: Ao invés de depender de scripts operacionais (como o `pg_dump` via CMD, que sofre com problemas de PATH no Windows), o SGDB construiu seu próprio motor de extração **Duplo**.
* **Modo 1: Snapshot JSON**: Com um clique no painel, o sistema gera um arquivo `JSON` leve, extraindo de forma estruturada as tabelas primárias (Empresas, Usuários, Chamados). Excelente para APIs e análise de dados.
* **Modo 2: Raw SQL Dump (Nativo)**: O padrão ouro para SGBD. A aplicação lê dinamicamente os arquivos de infraestrutura (DDL), empacota Procedures, Triggers, RLS, Schema e varre a base de dados linha a linha (DML) para gerar milhares de comandos `INSERT INTO`. O resultado é um arquivo `.sql` mastigado, pronto para ser jogado em um novo servidor e restaurar a aplicação 100% como estava.

### 4.3. Monitoramento Avançado (Painel Cockpit / NOC)
Um sistema de banco de dados não existe no escuro. O SGDB implementou um **Dashboard estilo Cockpit** exclusivo para o DBA (Administrador):
* **Métricas em Tempo Real**: Consulta as *System Views* dinâmicas do PostgreSQL (`pg_stat_activity`, `pg_database_size`) para exibir a saúde da instância.
* **Cache Hit Ratio**: Mede a eficiência do uso de memória RAM vs I/O de disco (quanto mais próximo a 100%, menos o banco está indo ao disco).
* **Top Queries**: Uma tabela ao vivo que lista os Processos Ativos (PIDs), permitindo identificar gargalos e consultas lentas.
* **Fragmentação (Dead Tuples)**: Alertas automáticos indicando tabelas que sofrem com *UPDATEs* constantes e precisam de desfragmentação (`VACUUM`).

### 4.4. Auditoria Imutável (System Logs)
Além do histórico de chamados, o SGBD implementa a tabela `sistema_log` para registrar eventos vitais do sistema:
* Registra execução de Backups (Sucesso ou Falha).
* Atua de forma paralela e resiliente (se algo quebrar na infra, o log avisa qual módulo falhou com sua respectiva classificação: INFO, WARN, ERROR, CRITICAL).

---
**SGDB** - Um ecossistema completo que une as melhores práticas de Service Desk corporativo à governança moderna de Banco de Dados.
