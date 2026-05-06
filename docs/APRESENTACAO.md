# Apresentação Geral: SGDB - Service Desk & Gestão de Ativos

Bem-vindo à apresentação comercial e técnica do **SGDB**. Este documento detalha todas as funcionalidades, módulos e vantagens competitivas da plataforma, projetada para atender desde pequenas operações de TI até grandes empresas de *Outsourcing* (B2B).

---

## 1. Visão Geral da Arquitetura (Multi-Tenant)
O SGDB foi concebido nativamente como uma plataforma **Multi-Tenant** (Multilocatária). 
Isso significa que uma única instalação do sistema pode gerenciar diversas "Empresas" (clientes) simultaneamente, com isolamento total de dados.

* **Isolamento de Visão**: Um usuário de suporte da "Empresa A" jamais verá os chamados ou o inventário da "Empresa B".
* **Visão Panorâmica (Global)**: O Administrador Global e os Técnicos de TI da empresa provedora do sistema conseguem visualizar, filtrar e atuar nos chamados de *todas* as empresas clientes em um único painel unificado.

## 2. Central de Chamados (Help Desk)
O coração do sistema. Uma fila de tickets projetada para ser ágil, com visual estilo código/hacker (fontes monospace em tabelas de dados) e design premium focado em alta visibilidade.

### O Fluxo Perfeito de Atendimento
1. **Abertura Inteligente**: O usuário reporta o problema informando a categoria e a severidade. Opcionalmente, pode vincular a tag patrimonial do computador defeituoso.
2. **SLA Adiado (Fair Play)**: Ao contrário de sistemas legados que punem o técnico se a fila estiver grande, o SGDB **não inicia o cronômetro de SLA na abertura do chamado**. O ticket aguarda na fila. O cronômetro de prazo máximo só é disparado no exato milissegundo em que um técnico assume a responsabilidade daquele chamado.
3. **Timer Visual Pulsante**: Quando atribuído, um cronômetro regressivo aparece na tela do técnico, atualizado a cada segundo. Se o prazo apertar (menos de 2 horas), o timer começa a pulsar em vermelho (efeito visual para priorização emergencial).
4. **Timeline e Auditoria**: Toda vez que o status do chamado muda (Aberto -> Em Atendimento -> Resolvido), o sistema automaticamente empilha um evento na "Linha do Tempo" do chamado, com data, hora, autor e mudança realizada. É impossível alterar o histórico.
5. **Recibos Virtuais (O "Cupom Fiscal" de TI)**: Com um clique, o sistema compila os detalhes técnicos do chamado (Datas, Resolução, Status, etc.) em uma visualização que imita uma Nota Fiscal ou um log de terminal. O usuário pode exportar essa visão como uma imagem PNG para guardar de recibo ou enviar no WhatsApp do setor.

## 3. Gestão de Ativos (Inventário de Hardware & Software)
Tão importante quanto resolver problemas é saber *onde* eles estão acontecendo.

* **Cadastro de Patrimônio**: Registre Laptops, Desktops, Monitores e Servidores com número de série, marca e data de garantia.
* **Vínculo Empregatício**: Todo hardware pode ser atribuído a uma Pessoa (Usuário) ou a um Departamento de uma Empresa específica.
* **Diagnóstico Integrado**: Ao abrir um chamado, o técnico já vê exatamente qual o processador, memória RAM e disco da máquina do usuário afetado, acelerando o *troubleshooting*.

## 4. Gestão de Acessos e Usuários
Quatro perfis distintos para manter o controle absoluto das permissões:

1. **ADMIN**: Acesso total. Cadastra novas empresas, cadastra novos técnicos, zera senhas e tem acesso global ao banco de dados e chamados de todas as instâncias.
2. **TECNICO**: O solucionador de problemas. Vê os chamados e o inventário de todas as empresas, pode assumir tickets, resolver, fechar e alterar status, mas não pode cadastrar novas filiais.
3. **EMPRESA_ADMIN**: O gestor local (do cliente). Pode ver todos os chamados abertos *apenas* da sua própria empresa, acompanhar as métricas do time e criar novos usuários dentro do seu CNPJ.
4. **USUARIO**: O usuário final. Só enxerga a si mesmo. Abre chamados em seu nome, vê o andamento das próprias solicitações e baixa os recibos quando os problemas são resolvidos.

## 5. UI/UX: A Estética do "Glassmorphism"
Fugindo das interfaces brancas e sem vida dos Service Desks tradicionais, o SGDB aposta em um Dark Mode moderno:

* Fundo escuro texturizado com painéis translúcidos (efeito vidro / glass).
* Bordas com brilho suave (Glow effect) nos botões de ação e modais centralizados para manter o foco absoluto na tarefa atual.
* Componentes flutuantes e botões empilhados para organização lógica e zero poluição visual.

---
**SGDB** - Pronto para modernizar o suporte de TI.
