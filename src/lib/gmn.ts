// Google Meu Negócio: critérios do GBP Check da Vertente e leitura dos dados do Google.

export interface PerfilGmn {
  id: string;
  cliente_id: string | null;
  nome: string;
  place_id: string | null;
  endereco: string | null;
  cidade: string | null;
  categoria: string | null;
  url_maps: string | null;
  palavras: string[];
  ativo: boolean;
}

export type Nivel = 0 | 1 | 2;
export interface CriterioAvaliado {
  id: string;
  nivel: Nivel;
  obs?: string;
  /** Análise da ficha (v2): 0–100, ou null quando falta verificar à mão */
  pct?: number | null;
  manual?: boolean;
}
export interface AnaliseGmn {
  id: string;
  perfil_id: string;
  data: string;
  nota: number;
  criterios: CriterioAvaliado[];
  dados: DadosGoogle;
  origem: "manual" | "google";
  observacoes: string | null;
  criado_em?: string;
}

export interface DadosGoogle {
  nota_media?: number | null;
  avaliacoes?: number | null;
  fotos?: number | null;
  site?: string | null;
  telefone?: string | null;
  categoria?: string | null;
  categorias?: number | null;
  tem_horario?: boolean;
  tem_descricao?: boolean;
  respostas_dono?: number | null; // das avaliações mais recentes lidas
  avaliacoes_lidas?: number | null;
  /** Análise completa (DataForSEO) */
  completo?: DadosCompletos;
  /** Análise da ficha v2: dados coletados e respostas das verificações manuais */
  versao?: 2;
  coleta?: import("./fichaGoogle").ColetaFicha;
  respostas?: Record<string, boolean>;
}

export interface InfoDfs {
  titulo: string | null;
  categoria: string | null;
  categorias_adicionais: string[];
  descricao: string | null;
  telefone: string | null;
  site: string | null;
  nota: number | null;
  avaliacoes: number | null;
  distribuicao: Record<string, number> | null;
  fotos: number | null;
  reivindicado: boolean | null;
  perguntas: number | null;
  tem_horario: boolean;
  atributos: number;
  servicos: number;
  temas: Record<string, number> | null;
  imagem: string | null;
}
export interface AvaliacaoDfs { nota: number | null; texto: string | null; autor: string | null; data: string | null; respondida: boolean; resposta_data: string | null; fotos?: number }
export interface PostagemDfs { data: string | null; texto: string | null; imagem: string | null; link: string | null }

export interface DadosCompletos {
  categorias: string[];
  descricao_tamanho: number;
  reivindicado: boolean | null;
  perguntas: number | null;
  distribuicao: Record<string, number> | null;
  temas: [string, number][];
  fotos: number | null;
  atributos: number;
  servicos: number;
  respostas_pct: number | null;
  avaliacoes_lidas: number;
  avaliacoes_sem_resposta: AvaliacaoDfs[];
  ultima_avaliacao: string | null;
  avaliacoes_30d: number;
  ultima_postagem: string | null;
  postagens_90d: number;
  postagens_recentes: PostagemDfs[];
  custo: number;
}

const diasDesde = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso.replace(" +00:00", "Z").replace(" ", "T")).getTime()) / 864e5) : null);
export { diasDesde };

/** Converte a análise completa (DataForSEO) em níveis sugeridos e observações automáticas. */
export function sugerirCompleto(info: InfoDfs, avaliacoes: AvaliacaoDfs[] | null, postagens: PostagemDfs[] | null, custo: number) {
  const n = info.avaliacoes ?? 0;
  const r = info.nota ?? 0;
  const fotos = info.fotos ?? 0;
  const cats = info.categorias_adicionais ?? [];
  const desc = info.descricao?.trim().length ?? 0;
  const niveis: Record<string, Nivel> = {};
  const obs: Record<string, string> = {};
  const set = (id: string, nv: Nivel, o?: string) => { niveis[id] = nv; if (o) obs[id] = o; };

  set("nome", /[|]| - .* - /.test(info.titulo ?? "") || (info.titulo?.length ?? 0) > 60 ? 1 : 2, info.titulo ? `No Google: "${info.titulo}"` : undefined);
  if (info.categoria) set("categoria", 2, `Categoria: ${info.categoria}`);
  set("categorias_sec", cats.length >= 3 ? 2 : cats.length >= 1 ? 1 : 0, cats.length ? `${cats.length} adicionais: ${cats.slice(0, 4).join(", ")}` : "Nenhuma categoria adicional");
  set("descricao", desc >= 400 ? 2 : desc >= 100 ? 1 : 0, desc ? `${desc} caracteres` : "Sem descrição");
  set("horario", info.tem_horario ? 2 : 0, info.tem_horario ? "Horário preenchido" : "Sem horário");
  set("contato", info.telefone && info.site ? 2 : info.telefone || info.site ? 1 : 0, [info.telefone ? "telefone" : null, info.site ? "site" : null].filter(Boolean).join(" e ") || "Sem telefone e site");
  if (info.servicos > 0) set("produtos", 2, `${info.servicos} serviços cadastrados`);
  if (info.atributos > 0) set("atributos", info.atributos >= 5 ? 2 : 1, `${info.atributos} atributos`);
  set("fotos", fotos >= 30 ? 2 : fotos >= 10 ? 1 : 0, `${fotos} fotos no perfil`);
  set("avaliacoes", n >= 100 ? 2 : n >= 30 ? 1 : 0, `${n} avaliações`);
  set("nota", r >= 4.7 ? 2 : r >= 4.3 ? 1 : 0, `Nota ${String(r).replace(".", ",")}`);
  if (info.perguntas) set("perguntas", 1, `${info.perguntas} perguntas no perfil`);

  let respostas_pct: number | null = null;
  const lidas = avaliacoes ?? [];
  if (lidas.length) {
    const resp = lidas.filter((a) => a.respondida).length;
    respostas_pct = Math.round((resp / lidas.length) * 100);
    set("respostas", respostas_pct >= 90 ? 2 : respostas_pct >= 50 ? 1 : 0, `${respostas_pct}% das últimas ${lidas.length} respondidas`);
  }
  const datasPost = (postagens ?? []).map((p) => diasDesde(p.data)).filter((d): d is number => d !== null).sort((a, b) => a - b);
  if (postagens) {
    const ult = datasPost[0];
    set("postagens", ult !== undefined && ult <= 7 ? 2 : ult !== undefined && ult <= 30 ? 1 : 0, ult !== undefined ? `Última postagem há ${ult} dia${ult === 1 ? "" : "s"}` : "Nenhuma postagem encontrada");
  }

  const completo: DadosCompletos = {
    categorias: [info.categoria, ...cats].filter(Boolean) as string[],
    descricao_tamanho: desc,
    reivindicado: info.reivindicado,
    perguntas: info.perguntas,
    distribuicao: info.distribuicao,
    temas: Object.entries(info.temas ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 10),
    fotos: info.fotos,
    atributos: info.atributos,
    servicos: info.servicos,
    respostas_pct,
    avaliacoes_lidas: lidas.length,
    avaliacoes_sem_resposta: lidas.filter((a) => !a.respondida).slice(0, 5),
    ultima_avaliacao: lidas[0]?.data ?? null,
    avaliacoes_30d: lidas.filter((a) => (diasDesde(a.data) ?? 999) <= 30).length,
    ultima_postagem: (postagens ?? []).find((p) => p.data)?.data ?? null,
    postagens_90d: datasPost.filter((d) => d <= 90).length,
    postagens_recentes: (postagens ?? []).slice(0, 3),
    custo,
  };
  const dados: DadosGoogle = {
    nota_media: info.nota,
    avaliacoes: info.avaliacoes,
    fotos: info.fotos,
    site: info.site,
    telefone: info.telefone,
    categoria: info.categoria,
    categorias: cats.length + (info.categoria ? 1 : 0),
    tem_horario: info.tem_horario,
    tem_descricao: desc > 0,
    respostas_dono: lidas.filter((a) => a.respondida).length,
    avaliacoes_lidas: lidas.length,
    completo,
  };
  return { dados, niveis, obs };
}

export const NIVEIS: { nivel: Nivel; nome: string; cor: string }[] = [
  { nivel: 0, nome: "Fraco", cor: "var(--bad)" },
  { nivel: 1, nome: "Razoável", cor: "var(--warn)" },
  { nivel: 2, nome: "Bom", cor: "var(--ok)" },
];

export interface Criterio {
  id: string;
  nome: string;
  grupo: "Informações" | "Fotos" | "Reputação" | "Atividade";
  peso: number;
  como: string; // o que é "Bom"
  recomendacao: string; // o que fazer quando não está Bom
}

export const CRITERIOS: Criterio[] = [
  { id: "nome", grupo: "Informações", nome: "Nome do perfil", peso: 5, como: "Nome real da empresa, sem palavras-chave forçadas", recomendacao: "Ajustar o nome para o nome real da empresa (palavra-chave forçada pode suspender o perfil)." },
  { id: "categoria", grupo: "Informações", nome: "Categoria principal", peso: 10, como: "Categoria mais específica do serviço principal", recomendacao: "Trocar a categoria principal pela mais específica do serviço que mais gera clientes." },
  { id: "categorias_sec", grupo: "Informações", nome: "Categorias secundárias", peso: 5, como: "3 ou mais categorias relacionadas", recomendacao: "Adicionar categorias secundárias para os outros serviços oferecidos." },
  { id: "descricao", grupo: "Informações", nome: "Descrição", peso: 6, como: "Descrição completa com serviços, cidade e diferenciais", recomendacao: "Escrever uma descrição de até 750 caracteres com serviços, bairro/cidade e diferenciais." },
  { id: "horario", grupo: "Informações", nome: "Horário de funcionamento", peso: 6, como: "Horário completo e feriados atualizados", recomendacao: "Preencher o horário de todos os dias e os horários especiais de feriado." },
  { id: "contato", grupo: "Informações", nome: "Telefone, WhatsApp e site", peso: 6, como: "Telefone e site/link de agendamento preenchidos", recomendacao: "Cadastrar telefone, site ou link do WhatsApp/agendamento." },
  { id: "produtos", grupo: "Informações", nome: "Produtos e serviços", peso: 6, como: "Serviços cadastrados com descrição e preço/foto", recomendacao: "Cadastrar os principais serviços/produtos com descrição e foto." },
  { id: "atributos", grupo: "Informações", nome: "Atributos e destaques", peso: 3, como: "Atributos marcados (acessibilidade, pagamentos, etc.)", recomendacao: "Marcar os atributos disponíveis (formas de pagamento, acessibilidade, Wi-Fi…)." },
  { id: "fotos", grupo: "Fotos", nome: "Quantidade de fotos", peso: 8, como: "Mais de 30 fotos (fachada, interior, equipe, serviços)", recomendacao: "Subir fotos de fachada, ambiente, equipe e serviços até passar de 30." },
  { id: "fotos_recentes", grupo: "Fotos", nome: "Fotos recentes", peso: 6, como: "Fotos novas nos últimos 30 dias", recomendacao: "Subir de 3 a 5 fotos novas por mês." },
  { id: "avaliacoes", grupo: "Reputação", nome: "Quantidade de avaliações", peso: 10, como: "Mais de 100 avaliações", recomendacao: "Criar rotina de pedir avaliação após o atendimento (link curto + QR code no balcão)." },
  { id: "nota", grupo: "Reputação", nome: "Nota média", peso: 10, como: "Nota 4,7 ou maior", recomendacao: "Responder às avaliações negativas e aumentar o volume de avaliações de clientes satisfeitos." },
  { id: "respostas", grupo: "Reputação", nome: "Respostas às avaliações", peso: 8, como: "Todas as avaliações respondidas", recomendacao: "Responder todas as avaliações, inclusive as antigas, em até 48 horas." },
  { id: "postagens", grupo: "Atividade", nome: "Postagens", peso: 8, como: "Postagem nos últimos 7 dias", recomendacao: "Publicar ao menos 1 postagem por semana (novidade, oferta ou evento)." },
  { id: "perguntas", grupo: "Atividade", nome: "Perguntas e respostas", peso: 3, como: "Perguntas frequentes respondidas", recomendacao: "Cadastrar e responder as perguntas mais comuns dos clientes." },
];

export function calcularNota(criterios: CriterioAvaliado[]): number {
  const total = CRITERIOS.reduce((s, c) => s + c.peso, 0);
  const pontos = CRITERIOS.reduce((s, c) => s + (c.peso * (criterios.find((x) => x.id === c.id)?.nivel ?? 0)) / 2, 0);
  return Math.round((pontos / total) * 100);
}

export function faixa(nota: number | null) {
  if (nota === null) return { nome: "Sem análise", cor: "var(--muted)" };
  if (nota >= 75) return { nome: "Bom", cor: "var(--ok)" };
  if (nota >= 50) return { nome: "Razoável", cor: "var(--warn)" };
  return { nome: "Fraco", cor: "var(--bad)" };
}

/** Perfil lido da Places API (New). */
export interface PerfilGoogle {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: unknown;
  editorialSummary?: { text: string };
  photos?: unknown[];
  reviews?: { rating: number; publishTime?: string; text?: { text: string }; authorAttribution?: { displayName: string } }[];
}

/** Converte os dados públicos do Google em sugestão de níveis (o resto continua manual). */
export function sugerirPeloGoogle(p: PerfilGoogle): { dados: DadosGoogle; niveis: Record<string, Nivel> } {
  const n = p.userRatingCount ?? 0;
  const r = p.rating ?? 0;
  const fotos = p.photos?.length ?? 0;
  const tipos = (p.types ?? []).filter((t) => !["point_of_interest", "establishment"].includes(t)).length;
  const dados: DadosGoogle = {
    nota_media: p.rating ?? null,
    avaliacoes: p.userRatingCount ?? null,
    fotos,
    site: p.websiteUri ?? null,
    telefone: p.nationalPhoneNumber ?? null,
    categoria: p.primaryTypeDisplayName?.text ?? null,
    categorias: tipos,
    tem_horario: Boolean(p.regularOpeningHours),
    tem_descricao: Boolean(p.editorialSummary?.text),
    avaliacoes_lidas: p.reviews?.length ?? 0,
  };
  const niveis: Record<string, Nivel> = {
    avaliacoes: n >= 100 ? 2 : n >= 30 ? 1 : 0,
    nota: r >= 4.7 ? 2 : r >= 4.3 ? 1 : 0,
    horario: p.regularOpeningHours ? 2 : 0,
    contato: p.nationalPhoneNumber && p.websiteUri ? 2 : p.nationalPhoneNumber || p.websiteUri ? 1 : 0,
    // a API devolve no máximo 10 fotos: 10 indica "muitas", menos que isso é pouco
    fotos: fotos >= 10 ? 1 : 0,
    categoria: p.primaryTypeDisplayName ? 1 : 0,
    categorias_sec: tipos >= 3 ? 2 : tipos >= 1 ? 1 : 0,
  };
  if (p.editorialSummary?.text) niveis.descricao = 1;
  return { dados, niveis };
}
