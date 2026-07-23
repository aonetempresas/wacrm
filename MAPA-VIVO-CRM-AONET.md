# 🗺️ Mapa Vivo — CRM Aonet Empresas

> **Documento vivo.** Guarda toda a análise do briefing da Aonet e as decisões que fomos travando.
> Vai sendo **reajustado** conforme o Renan valida as listas com o Marcos/Rodrigo e conforme a gente constrói.
> **Nada aqui é código** — é o plano organizado num lugar só.

- **Projeto:** CRM interno de vendas B2B/B2G da **Aonet Empresas** (provedor de internet/telecom)
- **Base técnica:** nosso CRM atual (wacrm) — Next.js 16 + Supabase
- **Briefing original (PDF):** `Briefing CRM - Exemplo + correção/Briefing CRM Aonet Empresas v2 1.docx.pdf` (13 páginas, VP Marcos de Angelo)
- **Última atualização:** 2026-07-22
- **Status:** 🔍 Discovery concluído · aguardando validação das listas e início da construção

---

## Índice
1. [A verdade de fundo (leitura honesta)](#1-a-verdade-de-fundo)
2. [Decisões travadas](#2-decisões-travadas)
3. [Modelo de negócio (MRR)](#3-modelo-de-negócio)
4. [O que JÁ temos e alinha](#4-o-que-já-temos-e-alinha)
5. [O que NÃO temos (construção nova)](#5-o-que-não-temos)
6. [As 4 Abas: como fica](#6-as-4-abas)
7. [Os 3 conflitos estruturais + risco](#7-conflitos-estruturais)
8. [Crítica ao próprio briefing](#8-crítica-ao-briefing)
9. [Resumo fiel do briefing (para não reabrir o PDF)](#9-resumo-fiel-do-briefing)
10. [Plano de construção em fases (A→G)](#10-plano-de-construção-em-fases)
11. [Pendências / a validar](#11-pendências)
12. [Histórico de mudanças deste documento](#12-histórico)

---

## 1. A verdade de fundo

Esse briefing **não descreve um "CRM de WhatsApp"**. Descreve um **CRM de vendas B2B/B2G para um provedor de internet**, cujo coração é: funil de 8 estágios, qualificação do lead, **metas de MRR (receita recorrente) por vendedor**, e inteligência de mercado. O WhatsApp aqui é **só 1 dos 7 canais de origem** (item 4.1), não o centro.

O nosso CRM (wacrm) nasceu com o centro **oposto**: a caixa de entrada do WhatsApp (inbox, templates, disparos, IA, fluxos).

**Consequência honesta:** o **alicerce do wacrm serve** (contas, contatos, funil, tarefas, cargos, banco seguro), mas **mais da metade do briefing é construção NOVA**, não "ajuste" ou "tradução". Isso é um **programa de vários meses**, não uma tarefa. O briefing foi escrito imaginando outra ferramenta ("Manus" + planilha Google) — vamos adaptar as ideias, não seguir a arquitetura dele ao pé da letra.

---

## 2. Decisões travadas

Decididas com o Renan em **2026-07-22**:

| # | Decisão | Efeito |
|---|---|---|
| 1 | **Não substitui o ERP Voalle.** É ferramenta operacional do dia a dia; o Voalle continua sendo o ERP pesado. | Reduz escopo — não replicamos o ERP. |
| 2 | **Sem acesso externo / portal de parceiro agora.** Foco no time interno. | Tira o item mais arriscado (Fase G) do caminho imediato. |
| 3 | **Supabase é a fonte da verdade.** Google Sheets/Excel só para **importar contatos** para dentro do CRM. | Descarta a "planilha como fonte da verdade" do briefing. |
| 4 | **8 estágios, mas flexíveis / remoldáveis.** Começar pelos 8; o que já existe, entender em que nível está e adaptar, sem perder o que temos. | Funil configurável, não engessado no código. |
| 5 | **Vendas são recorrentes (MRR)** — cliente paga todo mês — + taxa de instalação avulsa opcional. | Item 11 (metas MRR) é o coração. Muda o campo de valor do negócio (ver seção 3). |

---

## 3. Modelo de negócio

**Confirmado pelo Renan:** a Aonet vende **recorrência**. O cliente paga **todo mês** enquanto usa (ex.: link dedicado 1000 Mbps = R$ 3.500/mês). Às vezes há uma **taxa de instalação** cobrada uma única vez.

- **MRR** = *Receita Mensal Recorrente* = soma do que entra **todo mês**.
- **Hoje o nosso CRM trata todo negócio como valor único** (o campo de valor guarda um número só). Isso precisará mudar.
- **Quando chegarmos lá**, o "valor do negócio" vira dois campos:

| Campo | Exemplo | Natureza |
|---|---|---|
| **Valor mensal (MRR)** | R$ 3.500/mês | 🔁 Recorrente — entra todo mês |
| **Valor de instalação (setup)** | R$ 400 uma vez | 💵 Única vez — opcional |

- **MRR base** (estoque): recorrência que já existe na carteira (~R$ 239k hoje). Importa para a meta **anual**.
- **MRR novo** (fluxo): recorrência **nova** adicionada no mês. Importa para a meta **mensal** e para medir cada consultor.
- **Regra (correção do briefing):** o MRR novo vira MRR base **na virada do mês**.

---

## 4. O que já temos e alinha

Nosso trunfo — não estamos começando do zero:

| Briefing | No nosso CRM | Situação |
|---|---|---|
| **Seção 5 — Agenda de follow-ups** ("tela para hoje" + atrasados por consultor) | **Agenda "Meu Dia"** (construída — Fases 1 e 2) | 🎯 Já estamos exatamente aqui |
| Funil / oportunidades (seção 3) | **Funil (Pipelines/Deals)** | Fundação existe |
| Contatos (seção 8) | **Contatos** | Fundação existe (falta Empresas + papéis) |
| Data prevista de fechamento (seção 7) | Campo `expected_close_date` | Já existe |
| Pipeline ponderado (seção 7) | "Valor ponderado" no funil | Existe (por estágio, não por temperatura) |
| Lembrete automático de follow-up (seção 5, bônus) | **Motor de Automações** já existe | Só falta o passo "criar tarefa/lembrete" |
| "Leitura do WhatsApp cria lead" (etapa 2 deles) | **Inbox de WhatsApp já funciona** | Estamos **à frente** do plano deles |
| Ticket médio (correção 6.1) | "Ticket médio" no funil | Existe, mas com fórmula diferente (a ajustar) |

---

## 5. O que NÃO temos

Construção nova (a maior parte):

- **Qualificação do lead:** canal de origem (L1), temperatura quente/morno/frio com cor (4.2), produtos de interesse multi (L4), valor mensal MRR (4.3), operadora atual (L5), necessidade/dor multi (L7).
- **Motivo da perda** (multi, sem "escolheu concorrente") (L6) — obrigatório ao marcar "Não fechou".
- **Métricas por vendedor** + taxa de conversão individual + concentração de vendas.
- **Módulo de Metas / MRR inteiro** (item 11): MRR base vs novo, meta R$ 400k/mês até dez/2026, dias úteis (DU), projeção, farol verde/amarelo/vermelho, metas por consultor.
- **Empresas** (entidade nova) + **contatos com papéis** (decisor/técnico/financeiro/dono) (8.2 / L8).
- **Alerta de "lead esquecido"** (sem interação por ~7 dias e sem follow-up).
- **Histórico de interações** estruturado (ligação/visita/WhatsApp/proposta, datado).
- **Cidade** no lead; **conversão por canal**; **inteligência de mercado** agregada.

---

## 6. As 4 Abas

O briefing (Obs 3) quer 4 abas: **Empresas · Pessoas · Negócios · Atividades**. Mapa para o nosso CRM:

| Aba desejada | Nosso equivalente | O que muda |
|---|---|---|
| **Atividades** | ✅ **Agenda** (pronta) | + alerta "lead esquecido" + histórico de interações |
| **Negócios** | ✅ **Funil** (existe) | 8 estágios + temperatura + canal + MRR + produtos + motivo de perda |
| **Pessoas** | ✅ **Contatos** (existe) | + "papéis" (decisor/técnico/financeiro) |
| **Empresas** | ❌ **não existe** | criar entidade que agrupa contatos e negócios |
| *(Metas / MRR — item 11)* | ❌ não existe | provável **aba nova "Metas"** |
| *(Parceiros / comissão — seção 2)* | ❌ adiado (decisão 2) | portal separado, mais tarde |

Além dessas, o nosso CRM tem abas extras que o modelo clássico nem prevê: Inbox, Dashboard, Disparos, Automações, Fluxos, Agentes de IA, Configurações.

---

## 7. Conflitos estruturais

Não são "campos a mais" — são decisões de arquitetura onde mora o **risco**.

### 🔴 Conflito 1 — Modelo de acesso (o mais grave)
- **Briefing (seção 2):** consultor vê **só os próprios leads**; parceiro externo tem **portal isolado**.
- **Hoje:** todo membro da conta enxerga **tudo** (regra `is_account_member`). Não existe "cada um vê o seu".
- **Risco:** mudar isso mexe na **RLS** (segurança do banco) de **todas** as tabelas. Erro aqui = vendedor vendo dado de outro. **Fase isolada e muito testada.** (A parte do parceiro externo foi **adiada** pela decisão 2.)

### 🟡 Conflito 2 — Parceiro externo é usuário NÃO confiável
- Portal de parceiro = pessoas de fora entrando no sistema. Superfície de segurança nova inteira (quase um segundo app). **Adiado** (decisão 2). Fica para o fim.

### 🟢 Conflito 3 — Fonte da verdade (resolvido)
- Briefing pedia planilha Google como fonte da verdade. **Resolvido:** Supabase é a fonte (decisão 3). Planilha só para importar contatos.

---

## 8. Crítica ao briefing

Pontos do briefing que **não fecham** e devem ser revistos com o Marcos:

1. **"Não sugerir data automática" (correção do item 7)** briga com o princípio "sem fricção" do próprio briefing. **Meio-termo proposto:** campo vazio por padrão + botão "sugerir" ao lado (ganha os dois mundos).
2. **4 campos obrigatórios na criação** (canal, temperatura, valor mensal, próximo follow-up) brigam com "poucos campos obrigatórios". Revisar quais são MESMO obrigatórios já na criação.
3. **"Concentração de vendas" (correção do 11.4)** tem justificativa confusa — "concentração" normalmente significa *dependência de poucos negócios* (métrica de **risco**), quase o oposto do texto. **Clarificar o que o autor quis dizer.**
4. **Definir critério objetivo de temperatura** (correção do 4.2): o que é exatamente "dor clara, orçamento e decisor engajado"?
5. **Correção pendente do próprio briefing:** *depois de quantos dias sem desfecho um lead vira "perdido"?* (sugestão do doc: 7 dias para "lead esquecido"; o prazo de perda automática precisa ser definido).

---

## 9. Resumo fiel do briefing

> Para não precisar reabrir o PDF. Fiel ao documento v2 + correções.

### Perfis de acesso (seção 2) — 5 perfis
- **Gestor** (Marcos / Rodrigo): vê tudo, todos os funis, relatórios, dashboards; edita qualquer card.
- **Consultor comercial** (Luís Carlos, Rodrigo): cria/movimenta os próprios leads; vê seu pipeline e métricas; não edita leads de outro.
- **Backoffice** (Jessica): processa as vendas (estágios de fechamento/entrega).
- **Suporte corporativo** (Matheus Sitta): pós-venda / onboarding; vê dados do cliente ativo.
- **Parceiro externo** (adiado): acesso isolado. Dois tipos → **Indicador** (só indica, lead entra no estágio 1, atribuído a um consultor) e **Revenda** (vende de fato, entra direto no estágio 4; aciona comissão).

**Comissão do revenda (2.2):** 50% liberado quando a instalação é concluída (estágio 6); 50% quando o cliente faz o 1º pagamento (estágio 7). Dois selos de status por venda. (Tudo **adiado** com a decisão 2.)

### Funil — 8 estágios (seção 3 / L3)
**Funil de vendas (conta para conversão):**
1. **Conversa iniciada** — boca do funil (todo lead que iniciou contato, qualquer canal).
2. **Em viabilidade** — estudo técnico/viabilidade aberto (CGR/Projetos).
3. **Em negociação** — proposta apresentada, cliente avaliando.
4. **Venda efetivada (GANHO)** — contrato assinado. Conta como conversão. Revenda entra direto aqui.
5. **Não fechou (PERDIDO)** — recusa ou inviabilidade. **Exige motivo de perda (obrigatório).**

**Esteira de entrega e pós-venda (NÃO conta para conversão):**
6. **Agendado instalação** — ativação agendada (conclusão = gatilho 50% comissão revenda).
7. **Pós-venda / Onboarding** — primeiros dias do cliente (1º pagamento = gatilho outros 50%).
8. **Relacionamento comercial** — cliente ativo na base; origem de upsell/cross-sell.

**Regra de conversão:** Taxa = **Estágio 4 ÷ total de leads que entraram no funil no período**. Estágios 6, 7 e 8 ficam fora. Só entram no cálculo os leads já efetivados (4) ou perdidos (5) — os ainda em aberto não contam.

### Classificações do lead (seção 4)
- **4.1 Canal de entrada (L1)** — seleção única, obrigatória: Prospecção ativa (plataforma), Prospecção ativa (PAP), Receptivo, Tráfego pago, Indicação parceiro (+ qual parceiro), Venda parceiro/revenda (+ qual parceiro; entra no estágio 4), Base ativa (upsell).
- **4.2 Temperatura** — seleção única com cor: **Quente** (vermelho/laranja — dor clara, orçamento, decisor engajado), **Morno** (amarelo — interesse sem urgência), **Frio** (azul — contato inicial sem qualificação).
- **4.3 Potencial de venda** — Valor mensal estimado (MRR), Valor de setup/instalação (opcional), Produtos de interesse (multi, L4).
- **4.4 Inteligência de mercado (opcionais)** — Necessidade/dor (→ **multi**, L7), Operadora atual (L5), Valor pago hoje (R$).

### Agenda e follow-ups (seção 5)
- Campo **"Próximo follow-up" (data+hora)**, obrigatório enquanto o lead está em estágio ativo (1–3).
- Tela de agenda (calendário + lista "para hoje") com follow-ups do dia e atrasados em destaque, por consultor. ← **já temos ("Meu Dia")**.
- **Alerta de lead parado:** estágio ativo sem interação por X dias (sugestão 7) e sem follow-up → "leads esquecidos".
- **Histórico de interações por lead:** registro datado (ligação, visita, WhatsApp, proposta).
- **Bônus (etapa 2):** lembrete automático no WhatsApp/e-mail na véspera do follow-up.

### Métricas e dashboard (seção 6)
- **6.1 Por vendedor:** conversão individual, leads ativos por estágio, pipeline R$ + ponderado, previsão de fechamento por período, follow-ups do dia/atrasados, vendas no mês (qtd + R$ MRR), **+ Ticket Médio** (correção).
- **6.2 Geral/gestão:** conversão geral, funil consolidado (onde "vaza"), conversão por canal, performance por parceiro, **motivos de perda agregados** (ranking), inteligência de mercado, evolução de MRR × meta.

### Previsão e ciclo de venda (seção 7)
- Ciclos médios por produto (editáveis): PME/Corporativo ≈ 1–7 dias (mês corrente); Link Dedicado/LAN 30–60 dias; Prefeitura/licitação 60+ dias.
- **Data prevista de fechamento:** preenchível; correção → **não sugerir automático**.
- Pipeline ponderado (refinado): valor mensal × **peso da temperatura**, alocado no mês da data prevista. Pesos sugeridos: Quente **0,7** · Morno **0,4** · Frio **0,15** (a calibrar).

### Dicionário de campos (seção 8) + listas
- Listas editáveis pelo gestor: **L1** canais, **L2** parceiros (revenda/indicador), **L3** 8 estágios, **L4** produtos, **L5** operadoras, **L6** motivos de perda, **L7** dores, **L8** papéis do contato.
- **L4 Produtos:** Link Dedicado, Link Corporativo, PME, LAN to LAN, Wi-Fi Corporativo, Serviço de TI, Aonet 360, Voz (telefonia), Móvel, Redundância.
- **L5 Operadoras:** Vivo, Claro, Embratel/Vivo Empresas, Desktop, Outro provedor regional, Não possui.
- **L6 Motivo da perda** (correção → multi, **sem "Escolheu concorrente"**): Preço, Prazo de ativação, Inviabilidade técnica, Sem retorno do cliente, Projeto adiado/cancelado, Outro.
- **L7 Dores:** Instabilidade/quedas, Falta de suporte local, Lentidão/banda insuficiente, Precisa de IP fixo, Precisa de SLA/link dedicado, Expansão/nova filial, Preço alto do atual, Redundância/backup, Outro.
- **8.2 Contatos com papéis (L8):** um lead/cliente tem vários contatos, cada um com 1+ papéis — Decisor, Responsável técnico, Responsável financeiro, Dono, Outro. Coletado no fechamento (não obrigatório).

### Metas e resultados (seção 11)
- **MRR base** (~R$ 239k, estoque) × **MRR novo** (fluxo) — nunca somar num número só.
- **Meta anual:** R$ 400.000/mês de MRR base até 31/12/2026 (via upload de planilha do Voalle).
- **Meta mensal por dia útil (DU) + projeção:** DU editável; Meta por DU = meta ÷ DU; Projeção = (realizado ÷ DU decorridos) × DU do mês; **Farol:** verde ≥100%, amarelo 80–99%, vermelho <80%.
- **Meta por consultor:** MRR novo, Nº de vendas (correção → **Concentração de vendas**), Ticket médio, Atividade (leads/follow-ups). Diferenciadas e ajustáveis mês a mês.

### Faseamento do briefing (seção 12)
- **MVP:** kanban dos 8 estágios, ficha do lead (com contatos/papéis), agenda de follow-ups, comissão do revenda, metas leves (MRR novo e vendas), dashboard básico.
- **Etapa 2 (automação):** captura automática (Voalle, prospecção, tráfego pago, WhatsApp), MRR base do Voalle, lembretes automáticos.
- **Etapa 3 (inteligência):** pipeline ponderado por ciclo, metas de ticket/atividade, histórico mês a mês, alertas, relatórios de canal/parceiro, projeção anual.

---

## 10. Plano de construção em fases

> Ordem por **risco crescente** e valor. Nada começa sem o Renan mandar. Cada fase é validada (não quebra o que já existe) antes da próxima.

| Fase | O que entra | Aba | Risco | Depende de |
|---|---|---|---|---|
| **A — Qualificação do lead** ✅ **CONSTRUÍDA** | Canal de origem, temperatura (com cor), produtos (multi), valor mensal (MRR) + setup, motivo da perda (multi). Puro acréscimo. | Negócios | 🟢 Baixo | — |
| **B — Métricas por vendedor** ✅ **CONSTRUÍDA (v1)** | Painel "Desempenho por vendedor" no Painel (só admin+): por vendedor no mês — ganhos (qtd + R$), ticket médio, taxa de fechamento, pipeline aberto. | Dashboard | 🟡 Médio | A |
| **C — Follow-up inteligente** | "Próximo follow-up" obrigatório em estágio ativo, alerta de "lead esquecido", histórico de interações, lembrete automático (usa o motor de automações). | Atividades | 🟡 Médio | A |
| **D — Empresas + papéis** | Entidade "Empresa" agrupando contatos; papéis por contato (decisor/técnico/financeiro/dono). | Empresas / Pessoas | 🟡 Médio/estrutural | — |
| **E — Metas / MRR** | Módulo do item 11: MRR base × novo, meta mensal/anual, DU, projeção, farol, metas por consultor. | Metas (nova) | 🔴 Alto (módulo grande) | A, B |
| **F — Acesso "cada um vê o seu"** | RLS por dono do lead (consultor vê só os seus; gestor vê tudo). | (transversal) | 🔴 Alto (segurança) | — |
| **G — Portal de parceiro + comissão + Voalle** | Portal externo isolado, comissão (2 gatilhos), integração Voalle. | Portal externo | 🔴 Muito alto | **Adiado** (decisão 2) |

**Ponto de partida recomendado:** **Fase A** — maior valor com menor risco, e casa com o que já temos.

---

## 11. Pendências

**A validar com Marcos / Rodrigo / Luís / Cleber (antes de construir):**
- [ ] Listas L1–L8 (nomes exatos e definitivos).
- [ ] Critério objetivo de temperatura (4.2).
- [ ] Prazo para lead virar "perdido" sem desfecho (e "lead esquecido" = 7 dias?).
- [ ] O que "Concentração de vendas" significa de fato (11.4).
- [ ] Quais campos são MESMO obrigatórios na criação (vs. o princípio "sem fricção").
- [ ] Ciclos médios por produto e pesos do pipeline ponderado (recalibrar com dados).

**Decisões nossas em aberto:**
- [ ] Confirmar Fase A como início e quando começar.
- [ ] Como conviver o modelo atual (status ganho/perdido) com os 8 estágios fixos (estágio 4 = ganho, 5 = perdido).

---

## 12. Histórico

- **2026-07-23** — **Enriquecimento do lead (contato) + remoção do "Campos personalizados" genérico.** Migração `039_contact_market_intel.sql` (colunas aditivas em `contacts`: city, current_operator, current_monthly_price, pain_points[], pain_note) — rodada pelo Renan. Constantes L5 (operadoras) e L7 (dores) em `aonet-lists.ts`. Seção **"Inteligência de mercado (opcional)"** recolhida no formulário de contato (`contact-form.tsx`) — criar E editar — com Cidade, Operadora atual (lista), Valor que paga hoje (R$), Necessidade/dor (multi), abre sozinha se o contato já tiver dados. **Recurso genérico "Campos personalizados" REMOVIDO da vista** (a pedido do Renan, que tropeçava nele 3x): tirado o botão no topo de Contatos e a aba "Campos" da ficha (com todo o código relacionado — state/fetch/save/imports). O recurso/DB continua existindo, só não aparece; bônus: 1 aba a menos na ficha. Validado (tsc/build/i18n 1911=1911). **Ainda não commitado** (aguardando teste do Renan). Nota consciente: esses campos ainda NÃO aparecem como coluna na lista de contatos nem em relatório — próximo passo natural.
- **2026-07-22** — **Funil real da Aonet montado** (reconfiguração de dados, não código — via script service-role). O "FUNIL DIARIO" (6 etapas genéricas) virou **3 etapas ativas de venda**: Conversa iniciada (azul) → Em viabilidade (âmbar) → Em negociação (roxo). O único negócio existente foi preservado (movido pra Em negociação). **Decisão do Renan:** Ganho/Perdido continua MANUAL (botões), NÃO auto ao arrastar (consultor pode arrastar errado) — por isso "Venda efetivada"/"Não fechou" viraram botões, não colunas. Pendências anotadas pelo Renan: (1) consertar overflow horizontal / nomes cortados na aba lateral do "editar negócio" e "editar contato"; (2) revisar proporções visuais dessas abas. i18n: "Vendedor→Consultor", "Pipeline aberto→Em negociação".
- **2026-07-22** — **Fase B construída (v1).** Painel "Desempenho por vendedor" no Painel/Dashboard (visível só para admin+ / `canManageMembers`), mês corrente: por vendedor mostra ganhos (qtd + R$), ticket médio (R$ ganho ÷ nº ganhos), taxa de fechamento (ganhos ÷ (ganhos+perdidos)) e pipeline aberto. Nova query `loadRepPerformance` (agrega deals por `assigned_to`, client-side), tipo `RepPerformanceRow`, componente `rep-performance.tsx`, i18n `Dashboard.repPerformance`. Franqueza: usamos "taxa de fechamento" (não a conversão estrita do briefing "estágio 4 ÷ leads que entraram") porque ainda não rastreamos entrada no funil. Validado (tsc/build/i18n 1887=1887). **Aguardando teste do Renan; ainda não commitada.**
- **2026-07-22** — Documento criado. Briefing v2 lido por completo (13 páginas). Discovery concluído: 5 decisões travadas, modelo MRR confirmado, plano em fases A→G definido. Nenhuma linha de código escrita — só análise e planejamento.
- **2026-07-22** — **Refino de UX da Fase A** (feedback do Renan após testar). Título do negócio **removido da tela** (gerado sozinho: contato · produto). Dinheiro simplificado para **um único campo "Valor (R$)"** — removidos o "Valor mensal (MRR)", "Instalação" e o seletor de "Moeda" (MRR/instalação/produtos-preço ficam para o futuro módulo, junto do cadastro de produtos). **Bug de preço corrigido** em `currency.ts` (mostrava R$ 230 para 229,9; agora R$ 229,90 — deixa o Intl usar os centavos por moeda). **Temperatura pinta o card inteiro** (borda + fundo suave na cor) em vez de só a bolinha. Decisões conceituais firmadas: funil = tratativas; carteira/base = Voalle; "MRR" é jargão de gestor (fica pro módulo de Metas, calculado sozinho); listas ainda fixas no código (tela de editar listas = futuro, mesma família do cadastro de produtos/serviços). Validado (tsc/build/i18n 1876=1876). **Fase A inteira commitada e no GitHub: `472223b`.** Nota consciente p/ próximas fases: os estágios 6-8 do funil (entrega/pós-venda) são território do Voalle — nosso funil foca nos 5 estágios de venda. "Ticket médio" e conversão (Fase B) usam o campo `value` (valor único atual).
- **2026-07-22** — **Fase A construída.** Migração `038_lead_qualification.sql` (colunas aditivas em `deals`: temperature, source_channel, monthly_value, setup_value, products[], lost_reasons[], lost_reason_note) — rodada pelo usuário no Supabase. Listas em `src/lib/crm/aonet-lists.ts` (L1 canais, L4 produtos, L6 motivos, temperatura com cores). Formulário do negócio (`deal-form.tsx`): seção "Qualificação" (temperatura com cor, canal, MRR, instalação, produtos multi) + motivo da perda ao marcar "perdido" (multi, obrigatório). Card do funil (`deal-card.tsx`): bolinha de temperatura + valor mensal (MRR). i18n pt/en 1875=1875. tsc 0 erros, build OK. **Falta:** teste do usuário no navegador; commit no GitHub. **Não commitado ainda.**
