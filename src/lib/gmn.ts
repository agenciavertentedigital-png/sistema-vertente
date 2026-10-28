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
