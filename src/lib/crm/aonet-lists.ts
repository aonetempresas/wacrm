/**
 * Aonet CRM — qualification option lists (briefing seção 4 / L1, L4, L6).
 *
 * Each option is a stable *slug* stored in the DB; the human label is
 * resolved via i18n (Pipelines.channels / .products / .lostReasons /
 * .temperature) so the same slug reads correctly in pt/en. The manager
 * can't edit these from the UI yet — the briefing's lists aren't
 * validated, so they live here as constants for now (a future
 * "editable lists" feature can migrate them to a lookup table).
 *
 * IMPORTANT: never rename an existing slug — it's persisted on rows.
 * Add new ones at the end; retire by removing from the array only if
 * no row uses it.
 */

/** Lead heat — fixed set, each with a colour for the board (4.2). */
export const AONET_TEMPERATURES = ["quente", "morno", "frio"] as const;
export type AonetTemperature = (typeof AONET_TEMPERATURES)[number];

/**
 * Tailwind colour classes per temperature (briefing 4.2).
 * Quente = red/orange, Morno = amber, Frio = blue.
 *  - `dot`  : small solid dot
 *  - `chip` : bordered pill (form toggle)
 *  - `card` : soft border + faint background tint for the funnel card,
 *             so the whole card reads its heat at a glance.
 */
export const TEMPERATURE_STYLE: Record<
  AonetTemperature,
  { dot: string; chip: string; card: string }
> = {
  // Vermelho / amarelo / azul (briefing 4.2) — bem distintos entre si.
  quente: {
    dot: "bg-red-500",
    chip: "border-red-500/40 bg-red-500/10 text-red-500",
    card: "border-red-500/50 bg-red-500/5",
  },
  morno: {
    dot: "bg-amber-400",
    chip: "border-amber-400/40 bg-amber-400/10 text-amber-500",
    card: "border-amber-400/50 bg-amber-400/5",
  },
  frio: {
    dot: "bg-blue-500",
    chip: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    card: "border-blue-500/50 bg-blue-500/5",
  },
};

/**
 * Dias sem movimento até um negócio aberto contar como "parado" — usado
 * tanto no card "Parados" do topo do funil quanto no ⚠️ que pisca no
 * card do lead. Ajustável num lugar só.
 */
export const STUCK_DAYS = 7;

/** Canal de entrada — L1 (single select). */
export const AONET_CHANNELS = [
  "prospeccao_plataforma",
  "prospeccao_pap",
  "receptivo",
  "trafego_pago",
  "indicacao_parceiro",
  "venda_parceiro",
  "base_ativa",
] as const;

/** Produtos de interesse — L4 (multi select). */
export const AONET_PRODUCTS = [
  "link_dedicado",
  "link_corporativo",
  "pme",
  "lan_to_lan",
  "wifi_corporativo",
  "servico_ti",
  "aonet_360",
  "voz",
  "movel",
  "redundancia",
] as const;

/** Motivo da perda — L6 (multi select). "Escolheu concorrente" foi
 *  removido a pedido da correção do briefing (é concorrência das demais). */
export const AONET_LOSS_REASONS = [
  "preco",
  "prazo_ativacao",
  "inviabilidade_tecnica",
  "sem_retorno",
  "projeto_adiado",
  "outro",
] as const;

/** Operadora atual do cliente — L5 (single select, inteligência de
 *  mercado 4.4). Vive no CONTATO, não no negócio. */
export const AONET_OPERATORS = [
  "vivo",
  "claro",
  "embratel_vivo",
  "desktop",
  "outro_regional",
  "nao_possui",
] as const;

/** Necessidade / dor do cliente — L7 (MULTI select, correção do
 *  briefing). Vive no CONTATO. */
export const AONET_PAINS = [
  "instabilidade",
  "sem_suporte_local",
  "lentidao",
  "ip_fixo",
  "sla_dedicado",
  "expansao_filial",
  "preco_alto",
  "redundancia",
  "outro",
] as const;
