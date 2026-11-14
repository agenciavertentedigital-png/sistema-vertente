// Análise da Ficha do Google (GBP Check da Vertente): critérios, notas e textos do relatório.
// Dados: DataForSEO (perfil, avaliações, postagens, concorrentes) + Google Places (fotos em destaque, horário especial).
import { chamarFuncao } from "./tabela";
import type { AvaliacaoDfs, InfoDfs, PostagemDfs } from "./gmn";
import type { ColetaCompleta } from "./analiseCompleta";

export interface Concorrente {
  nome: string; posicao: number; nota: number | null; avaliacoes: number | null; categoria: string | null; reivindicado: boolean | null;
  place_id?: string; categorias_adicionais?: string[]; fotos?: number | null; descricao_tam?: number; atributos?: number | null; servicos?: number | null;
  site?: boolean; distancia_km?: number | null; tarefa_avaliacoes?: string | null;
  /** Avaliações novas (lidas das 20 mais recentes) */
  novas_30d?: number | null; novas_90d?: number | null; ultima_avaliacao?: string | null;
}

/** Dados que só a API oficial do dono tem (quando a ficha é gerenciada pela agência). */
export interface FatosOficiais { fundacao: boolean; videos: number; horario_especial: boolean; servicos: number; midia_dono: number; midia_clientes: number; ult_midia_dias: number | null; verificada: boolean | null }

export interface ColetaFicha {
  info: InfoDfs & { logo: string | null; place_id: string; cid: string | null; endereco: string | null; cidade: string | null; maps: string | null };
  fotos_destaque: { total: number; do_dono: number };
  horario_especial_proximos_dias: number;
  concorrentes: Concorrente[];
  posicao_categoria: number | null;
  palavra_concorrencia?: string | null;
  oficial?: FatosOficiais;
  avaliacoes: AvaliacaoDfs[];
  postagens: PostagemDfs[];
  custo: number;
  coletado_em: string;
}

export type Grupo = "Informações" | "Mídia" | "Avaliações" | "Atividade";
export interface Resultado { pct: number; texto: string }
export interface CriterioFicha {
  id: string;
  grupo: Grupo;
  nome: string;
  peso: number;
  porque: string;
  recomendacao: string;
  /** Pergunta para verificar à mão quando o dado não é público. */
  pergunta?: string;
  avaliar: (c: ColetaFicha) => Resultado | null;
}

export interface ItemAnalise { id: string; pct: number | null; texto: string; manual?: boolean }

const dias = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso.replace(" +00:00", "Z").replace(" ", "T")).getTime()) / 864e5) : null);
const faixaPct = (v: number, bom: number, razoavel: number) => (v >= bom ? 100 : v >= razoavel ? 60 : v > 0 ? 25 : 0);
const pctBR = (v: number) => `${Math.round(v)}%`;
const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const virgula = (v: number, casas = 1) => v.toFixed(casas).replace(".", ",");

export const CRITERIOS_FICHA: CriterioFicha[] = [
  // ---------------- Informações ----------------
  {
    id: "nome", grupo: "Informações", nome: "Nome do negócio", peso: 5,
    porque: "O nome deve ser o nome real da empresa, como aparece na fachada e no site. Palavra-chave forçada no nome pode suspender a ficha.",
    recomendacao: "Usar só o nome real da empresa, sem cidade, serviço ou slogan no nome.",
    avaliar: (c) => {
      const t = c.info.titulo ?? "";
      const forcado = /\s[-|–]\s.+\s[-|–]\s|\|/.test(t) || t.length > 60;
      return { pct: !t ? 0 : forcado ? 50 : 100, texto: !t ? "A ficha está sem nome." : forcado ? `O nome parece ter palavras extras (${t.length} caracteres): "${t}". O Google pode considerar isso spam.` : `Nome adequado, com ${t.length} caracteres: "${t}".` };
    },
  },
  {
    id: "categorias", grupo: "Informações", nome: "Categorias", peso: 8,
    porque: "A categoria principal é o fator que mais pesa para aparecer nas buscas. As secundárias ampliam as buscas em que a empresa aparece.",
    recomendacao: "Escolher a categoria principal mais específica do serviço que mais vende e adicionar de 3 a 5 categorias secundárias relacionadas.",
    avaliar: (c) => {
      const n = c.info.categorias_adicionais?.length ?? 0;
      if (!c.info.categoria) return { pct: 0, texto: "A ficha está sem categoria." };
      return { pct: n >= 3 ? 100 : n >= 1 ? 60 : 30, texto: `Categoria principal: ${c.info.categoria}. ${n ? `${n} secundária${n > 1 ? "s" : ""}: ${c.info.categorias_adicionais.join(", ")}.` : "Nenhuma categoria secundária."} Recomendado: 3 ou mais secundárias.` };
    },
  },
  {
    id: "descricao", grupo: "Informações", nome: "Descrição da empresa", peso: 6,
    porque: "A descrição conta a história da empresa e o que ela tem de diferente. Uma descrição completa ajuda o cliente a decidir e reforça as palavras do negócio.",
    recomendacao: "Escrever uma descrição de 400 a 750 caracteres com os serviços, a cidade/bairro e os diferenciais.",
    avaliar: (c) => {
      const n = c.info.descricao?.trim().length ?? 0;
      return { pct: n >= 400 ? 100 : n >= 250 ? 80 : n >= 50 ? 50 : 0, texto: n ? `A descrição tem ${n} caracteres (o máximo é 750; o ideal é passar de 400).` : "A ficha não tem descrição." };
    },
  },
  {
    id: "telefone", grupo: "Informações", nome: "Telefone", peso: 5,
    porque: "O telefone é uma das informações mais usadas: muita gente liga ou chama no WhatsApp direto da ficha.",
    recomendacao: "Cadastrar o telefone principal (de preferência o WhatsApp de atendimento).",
    avaliar: (c) => ({ pct: c.info.telefone ? 100 : 0, texto: c.info.telefone ? `Telefone definido: ${c.info.telefone}.` : "A ficha não tem telefone." }),
  },
  {
    id: "website", grupo: "Informações", nome: "Website", peso: 4,
    porque: "Ter site passa credibilidade e dá ao cliente mais um caminho para conhecer e falar com a empresa.",
    recomendacao: "Cadastrar o site, ou um link de agendamento/WhatsApp se a empresa não tiver site.",
    avaliar: (c) => ({ pct: c.info.site ? 100 : 0, texto: c.info.site ? `Site definido: ${c.info.site.replace(/^https?:\/\//, "").replace(/\/$/, "")}.` : "A ficha não tem site." }),
  },
  {
    id: "horario", grupo: "Informações", nome: "Horário de funcionamento", peso: 6,
    porque: "É informação-chave para o cliente saber quando pode ligar ou ir até a empresa. Fichas sem horário aparecem menos.",
    recomendacao: "Preencher o horário de todos os dias da semana.",
    avaliar: (c) => ({ pct: c.info.tem_horario ? 100 : 0, texto: c.info.tem_horario ? "Horário de funcionamento definido." : "A ficha não tem horário de funcionamento." }),
  },
  {
    id: "horario_especial", grupo: "Informações", nome: "Horário especial (feriados)", peso: 3,
    porque: "Informar se a empresa abre em feriados evita cliente batendo na porta fechada e mostra que a ficha é cuidada.",
    recomendacao: "Cadastrar os horários especiais dos feriados do ano (Natal, Ano-Novo, Carnaval…).",
    pergunta: "A ficha tem horário especial cadastrado para os próximos feriados?",
    avaliar: (c) => (c.oficial ? { pct: c.oficial.horario_especial ? 100 : 0, texto: c.oficial.horario_especial ? `Possui horário especial definido para ${new Date().getFullYear()}.` : `Não há horário especial (feriados) definido para ${new Date().getFullYear()}.` } : c.horario_especial_proximos_dias > 0 ? { pct: 100, texto: "A ficha tem horário especial definido para os próximos dias." } : null),
  },
  {
    id: "fundacao", grupo: "Informações", nome: "Data de fundação", peso: 1,
    porque: "Mostrar há quanto tempo a empresa existe passa confiança.",
    recomendacao: "Informar a data de abertura da empresa na ficha.",
    pergunta: "A ficha mostra a data de fundação/abertura?",
    avaliar: (c) => (c.oficial ? { pct: c.oficial.fundacao ? 100 : 0, texto: c.oficial.fundacao ? "A ficha tem a data de fundação." : "A ficha não mostra a data de fundação." } : null),
  },
  {
    id: "servicos", grupo: "Informações", nome: "Serviços e produtos", peso: 5,
    porque: "Os serviços cadastrados fazem a empresa aparecer em mais buscas e ajudam o cliente a entender rápido o que ela faz.",
    recomendacao: "Cadastrar os principais serviços/produtos com descrição (e preço/foto quando fizer sentido).",
    pergunta: "A ficha tem serviços ou produtos cadastrados?",
    avaliar: (c) => (c.info.servicos > 0 ? { pct: 100, texto: `${c.info.servicos} serviços cadastrados.` } : c.oficial ? { pct: 0, texto: "Nenhum serviço cadastrado." } : null),
  },
  {
    id: "atributos", grupo: "Informações", nome: "Atributos", peso: 2,
    porque: "Atributos (acessibilidade, formas de pagamento, Wi-Fi, estacionamento…) respondem dúvidas e aparecem como destaques na ficha.",
    recomendacao: "Marcar todos os atributos que se aplicam à empresa.",
    avaliar: (c) => ({ pct: faixaPct(c.info.atributos, 5, 2), texto: c.info.atributos ? `${c.info.atributos} atributo${c.info.atributos > 1 ? "s" : ""} marcado${c.info.atributos > 1 ? "s" : ""}. Recomendado: 5 ou mais.` : "Nenhum atributo marcado." }),
  },
  {
    id: "reivindicada", grupo: "Informações", nome: "Ficha reivindicada", peso: 4,
    porque: "Só a ficha reivindicada pode ser editada pelo dono. Sem isso, qualquer pessoa pode sugerir mudanças ou tentar reivindicar.",
    recomendacao: "Reivindicar e verificar a ficha no Google Business Profile.",
    avaliar: (c) => (c.oficial ? { pct: c.oficial.verificada === false ? 50 : 100, texto: c.oficial.verificada === false ? "A ficha está na conta da agência, mas ainda não verificada." : "A ficha é reivindicada e verificada." } : c.info.reivindicado === null ? null : { pct: c.info.reivindicado ? 100 : 0, texto: c.info.reivindicado ? "A ficha é reivindicada pelo proprietário." : "A ficha NÃO é reivindicada: qualquer pessoa pode tentar assumir." }),
  },

  // ---------------- Mídia ----------------
  {
    id: "logo", grupo: "Mídia", nome: "Logotipo", peso: 2,
    porque: "O logotipo ajuda o cliente a reconhecer a marca nas buscas e no Maps.",
    recomendacao: "Subir o logotipo em boa resolução (quadrado).",
    avaliar: (c) => ({ pct: c.info.logo ? 100 : 0, texto: c.info.logo ? "Existe uma imagem de logotipo definida." : "A ficha não tem logotipo." }),
  },
  {
    id: "capa", grupo: "Mídia", nome: "Foto de capa", peso: 3,
    porque: "A foto de capa costuma ser a primeira imagem que o cliente vê da empresa.",
    recomendacao: "Definir uma foto de capa bonita e atual (fachada ou ambiente principal).",
    avaliar: (c) => ({ pct: c.info.imagem ? 100 : 0, texto: c.info.imagem ? "A ficha tem foto de capa definida." : "A ficha não tem foto de capa." }),
  },
  {
    id: "midia_total", grupo: "Mídia", nome: "Quantidade total de fotos", peso: 6,
    porque: "Fichas com muitas fotos recebem mais cliques, ligações e pedidos de rota.",
    recomendacao: "Chegar a mais de 50 fotos: fachada, ambiente, equipe, produtos e serviços.",
    avaliar: (c) => {
      const n = c.info.fotos ?? 0;
      return { pct: n >= 50 ? 100 : n >= 20 ? 70 : n >= 5 ? 40 : 0, texto: `A ficha tem ${n} fotos e vídeos. Recomendado: mais de 50.` };
    },
  },
  {
    id: "midia_dono", grupo: "Mídia", nome: "Fotos publicadas pelo proprietário", peso: 4,
    porque: "As fotos do dono mostram a empresa do jeito que ela quer ser vista. Quando só aparecem fotos de clientes, a empresa perde o controle da imagem.",
    recomendacao: "Publicar fotos próprias de qualidade para que elas apareçam em destaque.",
    avaliar: (c) => {
      if (c.oficial) { const n = c.oficial.midia_dono; return { pct: n >= 20 ? 100 : n >= 10 ? 70 : n >= 3 ? 40 : n ? 20 : 0, texto: `${n} fotos e vídeos publicados pela empresa. Recomendado: 20 ou mais.` }; }
      const { total, do_dono } = c.fotos_destaque;
      if (!total) return null;
      return { pct: do_dono >= total / 2 ? 100 : do_dono >= 2 ? 60 : do_dono ? 30 : 0, texto: `${do_dono} das ${total} fotos em destaque na ficha foram publicadas pela própria empresa.` };
    },
  },
  {
    id: "midia_clientes", grupo: "Mídia", nome: "Fotos publicadas por clientes", peso: 3,
    porque: "Fotos de clientes provam que a empresa é real e passam confiança.",
    recomendacao: "Incentivar os clientes a postarem fotos junto com a avaliação (ex.: do produto, do resultado, do ambiente).",
    avaliar: (c) => {
      if (c.oficial) { const n = c.oficial.midia_clientes; return { pct: n >= 10 ? 100 : n >= 3 ? 70 : n ? 35 : 0, texto: `${n} foto${n === 1 ? "" : "s"} e vídeo${n === 1 ? "" : "s"} publicados por clientes. Recomendado: 10 ou mais.` }; }
      const comFoto = c.avaliacoes.filter((a) => (a.fotos ?? 0) > 0).length;
      const naoDono = c.fotos_destaque.total - c.fotos_destaque.do_dono;
      const n = comFoto + Math.max(0, naoDono);
      if (!c.avaliacoes.length && !c.fotos_destaque.total) return null;
      return { pct: n >= 10 ? 100 : n >= 3 ? 70 : n ? 35 : 0, texto: `${comFoto} das últimas ${c.avaliacoes.length} avaliações têm foto do cliente${naoDono > 0 ? `, e ${naoDono} das fotos em destaque são de clientes` : ""}.` };
    },
  },
  {
    id: "midia_recente", grupo: "Mídia", nome: "Data da última foto do proprietário", peso: 4,
    porque: "Publicar fotos com frequência mostra ao Google que a ficha está ativa.",
    recomendacao: "Subir de 3 a 5 fotos novas por mês (no máximo a cada 60 dias).",
    pergunta: "O proprietário publicou foto ou vídeo nos últimos 60 dias?",
    avaliar: (c) => {
      if (c.oficial?.ult_midia_dias != null) { const d = c.oficial.ult_midia_dias; return { pct: d <= 30 ? 100 : d <= 60 ? 60 : d <= 120 ? 30 : 0, texto: `A última foto ou vídeo da empresa foi publicada há ${d} dias. Recomendado: no máximo 30 dias.` }; }
      const comImg = c.postagens.filter((p) => p.imagem).map((p) => dias(p.data)).filter((d): d is number => d !== null).sort((a, b) => a - b);
      if (!comImg.length) return null;
      const d = comImg[0];
      return { pct: d <= 30 ? 100 : d <= 60 ? 80 : d <= 120 ? 40 : 0, texto: `A última foto publicada pela empresa (numa postagem) foi há ${d} dias. Máximo recomendado: 60 dias.` };
    },
  },
  {
    id: "videos", grupo: "Mídia", nome: "Vídeos", peso: 2,
    porque: "Vídeos curtos do ambiente e dos serviços atraem mais e prendem a atenção do cliente na ficha.",
    recomendacao: "Publicar ao menos 3 vídeos curtos (10–30 s) da empresa.",
    pergunta: "A ficha tem 3 ou mais vídeos?",
    avaliar: (c) => (c.oficial ? { pct: c.oficial.videos >= 3 ? 100 : c.oficial.videos ? 50 : 0, texto: c.oficial.videos ? `${c.oficial.videos} vídeo${c.oficial.videos > 1 ? "s" : ""}. Recomendado: 3 ou mais.` : "A ficha não tem vídeos." } : null),
  },

  // ---------------- Avaliações ----------------
  {
    id: "aval_qtd", grupo: "Avaliações", nome: "Quantidade de avaliações", peso: 9,
    porque: "Quantidade de avaliações é um dos fatores de ranqueamento e a primeira coisa que o cliente compara entre empresas.",
    recomendacao: "Criar uma rotina de pedir avaliação logo após o atendimento (link curto + QR code no balcão).",
    avaliar: (c) => {
      const n = c.info.avaliacoes ?? 0;
      const lider = Math.max(0, ...c.concorrentes.map((x) => x.avaliacoes ?? 0));
      const comp = lider ? ` O concorrente com mais avaliações na região tem ${lider}.` : "";
      return { pct: n >= 100 ? 100 : n >= 50 ? 75 : n >= 20 ? 45 : n >= 3 ? 25 : 0, texto: `A ficha tem ${n} avaliações. Recomendado: mais de 100.${comp}` };
    },
  },
  {
    id: "aval_media", grupo: "Avaliações", nome: "Média das avaliações", peso: 8,
    porque: "Uma nota alta transmite segurança. Abaixo de 4,5 muita gente já prefere o concorrente.",
    recomendacao: "Responder as avaliações negativas e aumentar o volume de avaliações de clientes satisfeitos.",
    avaliar: (c) => {
      const r = c.info.nota ?? 0;
      return { pct: r >= 4.7 ? 100 : r >= 4.5 ? 80 : r >= 4.2 ? 55 : r >= 4 ? 35 : 0, texto: r ? `Nota média ${virgula(r)} de 5. Recomendado: 4,7 ou mais.` : "Ainda sem nota." };
    },
  },
  {
    id: "aval_comentario", grupo: "Avaliações", nome: "Avaliações com comentário", peso: 4,
    porque: "As pessoas confiam mais nas avaliações escritas, e as palavras usadas pelos clientes ajudam a ficha a aparecer nas buscas.",
    recomendacao: "Ao pedir a avaliação, pedir também que o cliente conte em uma frase como foi a experiência.",
    avaliar: (c) => {
      if (!c.avaliacoes.length) return null;
      const com = c.avaliacoes.filter((a) => (a.texto ?? "").trim().length > 3).length;
      const p = (com / c.avaliacoes.length) * 100;
      return { pct: p >= 60 ? 100 : p >= 40 ? 70 : p >= 20 ? 40 : 10, texto: `${pctBR(p)} das últimas ${c.avaliacoes.length} avaliações têm comentário escrito (${c.avaliacoes.length - com} sem comentário).` };
    },
  },
  {
    id: "aval_resposta", grupo: "Avaliações", nome: "Avaliações respondidas", peso: 8,
    porque: "Responder mostra que a empresa se importa com o cliente, e o Google valoriza fichas que interagem.",
    recomendacao: "Responder todas as avaliações em até 48 horas, inclusive as antigas, e principalmente as negativas.",
    avaliar: (c) => {
      if (!c.avaliacoes.length) return null;
      const resp = c.avaliacoes.filter((a) => a.respondida).length;
      const p = (resp / c.avaliacoes.length) * 100;
      const negSem = c.avaliacoes.filter((a) => !a.respondida && (a.nota ?? 5) <= 3).length;
      return { pct: p >= 95 ? 100 : p >= 80 ? 80 : p >= 50 ? 50 : p >= 20 ? 25 : 0, texto: `${pctBR(p)} das últimas ${c.avaliacoes.length} avaliações foram respondidas (${c.avaliacoes.length - resp} sem resposta${negSem ? `, ${negSem} delas com nota 3 ou menos` : ""}).` };
    },
  },
  {
    id: "aval_tempo_resposta", grupo: "Avaliações", nome: "Tempo de resposta", peso: 3,
    porque: "Responder rápido mostra cuidado e aumenta a chance de reverter uma avaliação ruim.",
    recomendacao: "Definir uma rotina para responder as avaliações em até 2 dias.",
    avaliar: (c) => {
      const tempos = c.avaliacoes
        .filter((a) => a.respondida && a.resposta_data && a.data)
        .map((a) => (new Date(a.resposta_data!.replace(" +00:00", "Z").replace(" ", "T")).getTime() - new Date(a.data!.replace(" +00:00", "Z").replace(" ", "T")).getTime()) / 864e5)
        .filter((d) => d >= 0)
        .sort((a, b) => a - b);
      if (!tempos.length) return null;
      const med = tempos[Math.floor(tempos.length / 2)];
      return { pct: med <= 2 ? 100 : med <= 7 ? 70 : med <= 30 ? 35 : 10, texto: `As respostas saem em ${med < 1 ? "menos de 1 dia" : `${Math.round(med)} dia${Math.round(med) > 1 ? "s" : ""}`} (mediana). Recomendado: até 2 dias.` };
    },
  },
  {
    id: "aval_tendencia", grupo: "Avaliações", nome: "Tendência das avaliações", peso: 4,
    porque: "Mostra se as avaliações recentes estão melhores, estáveis ou piores que o histórico da empresa.",
    recomendacao: "Se a média recente caiu, investigar o que mudou no atendimento e responder os clientes insatisfeitos.",
    avaliar: (c) => {
      const notas = c.avaliacoes.map((a) => a.nota).filter((n): n is number => typeof n === "number");
      if (notas.length < 6) return null;
      const recentes = media(notas.slice(0, 10));
      const geral = c.info.nota ?? media(notas);
      const dif = recentes - geral;
      const txt = dif >= 0.1 ? "subindo" : dif <= -0.3 ? "caindo" : dif <= -0.1 ? "levemente abaixo da média geral" : "estável";
      return { pct: dif >= -0.1 ? 100 : dif >= -0.3 ? 60 : 20, texto: `A média das 10 avaliações mais recentes é ${virgula(recentes)} (geral: ${virgula(geral)}): está ${txt}.` };
    },
  },
  {
    id: "aval_ritmo", grupo: "Avaliações", nome: "Avaliações novas (30 dias)", peso: 5,
    porque: "O Google valoriza fichas que recebem avaliações com frequência; avaliação antiga perde força com o tempo.",
    recomendacao: "Ter uma meta de avaliações novas por mês (ex.: 8 ou mais) e pedir a todo cliente satisfeito.",
    avaliar: (c) => {
      if (!c.avaliacoes.length) return { pct: 0, texto: "Nenhuma avaliação recente encontrada." };
      const n = c.avaliacoes.filter((a) => (dias(a.data) ?? 999) <= 30).length;
      const ult = dias(c.avaliacoes[0]?.data);
      return { pct: n >= 8 ? 100 : n >= 4 ? 75 : n >= 1 ? 40 : 0, texto: `${n} avaliação${n === 1 ? "" : "ões"} nos últimos 30 dias. A mais recente foi há ${ult ?? "—"} dias.` };
    },
  },

  // ---------------- Atividade ----------------
  {
    id: "post_ultima", grupo: "Atividade", nome: "Data da última postagem", peso: 6,
    porque: "Postar novidades, ofertas e eventos mostra que a empresa está ativa e pode melhorar a visibilidade.",
    recomendacao: "Publicar ao menos 1 postagem por semana na ficha.",
    avaliar: (c) => {
      const d = c.postagens.map((p) => dias(p.data)).filter((x): x is number => x !== null).sort((a, b) => a - b)[0];
      if (d === undefined) return { pct: 0, texto: "Nenhuma postagem encontrada na ficha." };
      return { pct: d <= 7 ? 100 : d <= 15 ? 80 : d <= 30 ? 55 : d <= 60 ? 25 : 0, texto: `A última postagem foi há ${d} dia${d === 1 ? "" : "s"}. Recomendado: no máximo 7 dias.` };
    },
  },
  {
    id: "post_frequencia", grupo: "Atividade", nome: "Frequência de postagens", peso: 4,
    porque: "Constância nas postagens vale mais que postar muito de uma vez e parar.",
    recomendacao: "Manter um calendário de 4 a 8 postagens por mês.",
    avaliar: (c) => {
      const n = c.postagens.filter((p) => (dias(p.data) ?? 999) <= 90).length;
      return { pct: n >= 12 ? 100 : n >= 6 ? 70 : n >= 2 ? 35 : 0, texto: `${n} postage${n === 1 ? "m" : "ns"} nos últimos 90 dias. Recomendado: 12 ou mais (1 por semana).` };
    },
  },
];

export const GRUPOS_FICHA: Grupo[] = ["Informações", "Mídia", "Avaliações", "Atividade"];

export function statusPct(pct: number | null) {
  if (pct === null) return { nome: "Verificar", cor: "var(--muted)", chave: "verificar" as const };
  if (pct >= 80) return { nome: "Bom", cor: "var(--ok)", chave: "bom" as const };
  if (pct >= 40) return { nome: "Razoável", cor: "var(--warn)", chave: "razoavel" as const };
  return { nome: "Fraco", cor: "var(--bad)", chave: "fraco" as const };
}

/** Avalia todos os critérios com os dados coletados (os sem dado público ficam para verificar). */
export function avaliarFicha(c: ColetaFicha, respostasManuais: Record<string, boolean> = {}): ItemAnalise[] {
  return CRITERIOS_FICHA.map((cr) => {
    const r = cr.avaliar(c);
    if (r) return { id: cr.id, pct: r.pct, texto: r.texto };
    if (cr.id in respostasManuais) {
      const sim = respostasManuais[cr.id];
      return { id: cr.id, pct: sim ? 100 : 0, texto: sim ? "Verificado na ficha: sim." : "Verificado na ficha: não.", manual: true };
    }
    return { id: cr.id, pct: null, texto: "Dado não público: verifique na ficha e marque.", manual: true };
  });
}

/** Nota de 0 a 100 ponderada pelos pesos (critérios sem dado ficam de fora). */
export function notaFicha(itens: ItemAnalise[]) {
  let s = 0;
  let t = 0;
  for (const it of itens) {
    const cr = CRITERIOS_FICHA.find((x) => x.id === it.id);
    if (!cr || it.pct === null) continue;
    s += cr.peso * it.pct;
    t += cr.peso;
  }
  return t ? Math.round(s / t) : 0;
}

/** Roda a coleta completa (perfil já, avaliações e postagens em até ~2 min). */
export async function coletarFicha(placeId: string, aviso: (t: string) => void): Promise<ColetaFicha> {
  aviso("Lendo a ficha no Google e buscando concorrentes…");
  const r = await chamarFuncao<Omit<ColetaFicha, "avaliacoes" | "postagens" | "coletado_em"> & { tarefas: { avaliacoes: string; postagens: string } }>("gbp-check", { acao: "ficha", place_id: placeId });
  aviso("Lendo as avaliações e postagens (até 2 minutos)…");
  for (let i = 0; i < 30; i++) {
    await new Promise((ok) => setTimeout(ok, 5000));
    const t = await chamarFuncao<{ pronto: boolean; avaliacoes?: AvaliacaoDfs[]; postagens?: PostagemDfs[]; custo?: number }>("gbp-check", { acao: "completo_resultado", ...r.tarefas });
    if (t.pronto) {
      const { tarefas: _t, ...resto } = r;
      void _t;
      aviso("Medindo o ritmo de avaliações dos concorrentes…");
      const conc = await completarRitmo(resto.concorrentes ?? []);
      return { ...resto, concorrentes: conc.lista, avaliacoes: t.avaliacoes ?? [], postagens: t.postagens ?? [], custo: r.custo + (t.custo ?? 0) + conc.custo, coletado_em: new Date().toISOString() };
    }
    aviso(`Lendo as avaliações e postagens… (${(i + 1) * 5}s)`);
  }
  throw new Error("As avaliações e postagens demoraram demais. Tente de novo em alguns minutos.");
}

/** Lê o ritmo de avaliações dos concorrentes (tarefas da DataForSEO). Espera até ~60 s e segue com o que tiver. */
export async function completarRitmo(lista: Concorrente[]): Promise<{ lista: Concorrente[]; custo: number }> {
  const tarefas = Object.fromEntries(lista.filter((x) => x.place_id && x.tarefa_avaliacoes).map((x) => [x.place_id!, x.tarefa_avaliacoes!]));
  if (!Object.keys(tarefas).length) return { lista, custo: 0 };
  let ritmo: Record<string, { novas_30d: number; novas_90d: number; ultima: string | null } | null> = {};
  let custo = 0;
  for (let i = 0; i < 12; i++) {
    const r = await chamarFuncao<{ pronto: boolean; ritmo: typeof ritmo; custo: number }>("gbp-check", { acao: "concorrentes_ritmo", tarefas }).catch(() => null);
    if (r) { ritmo = r.ritmo; custo = r.custo; if (r.pronto) break; }
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  return {
    lista: lista.map((x) => {
      const k = x.place_id ? ritmo[x.place_id] : null;
      const { tarefa_avaliacoes: _t, ...resto } = x;
      void _t;
      return k ? { ...resto, novas_30d: k.novas_30d, novas_90d: k.novas_90d, ultima_avaliacao: k.ultima } : resto;
    }),
    custo,
  };
}

/** Concorrentes para fichas da análise oficial (que não passam pela coleta pública). */
export async function buscarConcorrentes(placeId: string, palavra?: string) {
  const r = await chamarFuncao<{ concorrentes: Concorrente[]; posicao: number | null; palavra: string; custo: number }>("gbp-check", { acao: "concorrentes", place_id: placeId, palavra });
  const ritmo = await completarRitmo(r.concorrentes);
  return { concorrentes: ritmo.lista, posicao: r.posicao, palavra: r.palavra, custo: r.custo + ritmo.custo };
}

/** Converte a coleta da API oficial (ficha gerenciada) no formato da análise da ficha, para usar a mesma nota. */
export function coletaDeOficial(c: ColetaCompleta, extra?: { concorrentes?: Concorrente[]; posicao?: number | null; palavra?: string | null }): ColetaFicha {
  const f = c.ficha;
  const valida = (d: string) => !d.startsWith("1970");
  const dono = Number(c.midia_dono_total ?? c.midia_dono.length);
  const cli = Number(c.midia_clientes_total ?? c.midia_clientes.length);
  const videos = [...c.midia_dono, ...c.midia_clientes].filter((m) => m.formato === "VIDEO").length;
  const ultMidia = c.midia_dono.map((m) => m.data).filter(valida).sort().pop() ?? null;
  const ano = new Date().getFullYear();
  const dist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const a of c.avaliacoes) if (a.nota) dist[String(a.nota)] = (dist[String(a.nota)] ?? 0) + 1;
  const end = f.endereco;
  return {
    info: {
      titulo: f.nome, categoria: f.categoria, categorias_adicionais: f.categorias_extras ?? [], descricao: f.descricao, telefone: f.telefone, site: f.site,
      nota: c.avaliacoes_media, avaliacoes: c.avaliacoes_total, distribuicao: dist, fotos: dono + cli, reivindicado: f.verificada ?? true, perguntas: null,
      tem_horario: Boolean(f.horario?.periods?.length), atributos: f.atributos?.length ?? 0, servicos: f.servicos?.length ?? 0, temas: null,
      imagem: c.midia_dono.some((m) => m.categoria === "COVER") ? "capa" : null,
      logo: c.midia_dono.some((m) => m.categoria === "PROFILE" || m.categoria === "LOGO") ? "logo" : null,
      place_id: c.local.place_id, cid: null,
      endereco: end ? [...(end.addressLines ?? []), end.sublocality, end.locality, end.administrativeArea].filter(Boolean).join(", ") : null,
      cidade: c.local.cidade, maps: f.maps ?? c.local.maps,
    },
    fotos_destaque: { total: dono + cli, do_dono: dono },
    horario_especial_proximos_dias: (f.horario_especial?.specialHourPeriods ?? []).some((p) => p.startDate?.year === ano) ? 1 : 0,
    concorrentes: extra?.concorrentes ?? [],
    posicao_categoria: extra?.posicao ?? null,
    palavra_concorrencia: extra?.palavra ?? null,
    oficial: {
      fundacao: Boolean(f.fundacao?.year), videos, horario_especial: (f.horario_especial?.specialHourPeriods ?? []).some((p) => p.startDate?.year === ano),
      servicos: f.servicos?.length ?? 0, midia_dono: dono, midia_clientes: cli,
      ult_midia_dias: ultMidia ? Math.floor((Date.now() - new Date(ultMidia).getTime()) / 864e5) : null, verificada: f.verificada,
    },
    avaliacoes: c.avaliacoes.map((a) => ({ nota: a.nota, texto: a.texto || null, autor: a.autor, data: a.data, respondida: Boolean(a.resposta), resposta_data: a.resposta_data, fotos: 0 })),
    postagens: c.postagens.map((p) => ({ data: p.data, texto: p.texto, imagem: p.midia > 0 ? "midia" : null, link: p.url })),
    custo: 0,
    coletado_em: c.coletado_em,
  };
}

// ------------------------------------------------------------------
// Comparativo com concorrentes: o que separa a ficha dos primeiros colocados
// ------------------------------------------------------------------
export interface Insight { titulo: string; texto: string; tom: "bom" | "atencao" | "ruim" }

export function insightsConcorrencia(c: ColetaFicha): Insight[] {
  const lista = c.concorrentes;
  if (!lista.length) return [];
  const out: Insight[] = [];
  const eu = { aval: c.info.avaliacoes ?? 0, nota: c.info.nota ?? 0, fotos: c.info.fotos ?? 0, novas: c.avaliacoes.filter((a) => (dias(a.data) ?? 999) <= 30).length };
  const virg = (v: number) => v.toFixed(1).replace(".", ",");
  const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");

  // Avaliações: líder em volume e o ritmo necessário para alcançá-lo em 6 meses
  const lider = [...lista].sort((a, b) => (b.avaliacoes ?? 0) - (a.avaliacoes ?? 0))[0];
  if (lider && (lider.avaliacoes ?? 0) > eu.aval) {
    const ritmoLider = lider.novas_30d ?? 0;
    const precisa = Math.ceil(((lider.avaliacoes ?? 0) + ritmoLider * 6 - eu.aval) / 6);
    out.push({ titulo: "Avaliações", tom: "ruim", texto: `${lider.nome} tem ${n0(lider.avaliacoes ?? 0)} avaliações${lider.novas_30d != null ? ` e recebeu ${lider.novas_30d} no último mês` : ""}. Você tem ${n0(eu.aval)} (${eu.novas} no último mês). Para alcançá-lo em 6 meses: cerca de ${precisa} avaliações novas por mês.` });
  } else if (lider) {
    out.push({ titulo: "Avaliações", tom: "bom", texto: `Você tem mais avaliações que todos os concorrentes do topo (${n0(eu.aval)} contra ${n0(lider.avaliacoes ?? 0)} do segundo). Manter o ritmo de ${eu.novas} por mês para não perder a liderança.` });
  }

  // Ritmo de avaliações (quem está crescendo mais rápido)
  const comRitmo = lista.filter((x) => x.novas_30d != null);
  if (comRitmo.length) {
    const rapido = [...comRitmo].sort((a, b) => (b.novas_30d ?? 0) - (a.novas_30d ?? 0))[0];
    if ((rapido.novas_30d ?? 0) > eu.novas) out.push({ titulo: "Ritmo de avaliações", tom: "atencao", texto: `${rapido.nome} está recebendo avaliações mais rápido: ${rapido.novas_30d} no último mês, contra ${eu.novas} da sua ficha. Quem recebe avaliações com frequência ganha força no Maps.` });
  }

  // Categorias usadas pelos concorrentes e não pela ficha
  const minhas = new Set([c.info.categoria, ...(c.info.categorias_adicionais ?? [])].filter(Boolean).map((x) => String(x).toLowerCase()));
  const freq = new Map<string, number>();
  for (const x of lista) for (const cat of new Set([x.categoria, ...(x.categorias_adicionais ?? [])].filter(Boolean) as string[])) if (!minhas.has(cat.toLowerCase())) freq.set(cat, (freq.get(cat) ?? 0) + 1);
  const faltam = [...freq.entries()].filter(([, v]) => v >= 2 || lista.length <= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (faltam.length) out.push({ titulo: "Categorias", tom: "atencao", texto: `Categorias que os concorrentes usam e a sua ficha não: ${faltam.map(([k, v]) => `${k} (${v} de ${lista.length})`).join(", ")}. Avaliar quais combinam com os serviços e adicionar como secundárias.` });

  // Fotos
  const fotosConc = lista.map((x) => x.fotos).filter((v): v is number => typeof v === "number");
  if (fotosConc.length) {
    const m = fotosConc.reduce((s, v) => s + v, 0) / fotosConc.length;
    if (eu.fotos < m * 0.8) out.push({ titulo: "Fotos", tom: "atencao", texto: `A ficha tem ${n0(eu.fotos)} fotos; a média dos concorrentes é ${n0(m)}. Fichas com mais fotos recebem mais cliques e pedidos de rota.` });
    else out.push({ titulo: "Fotos", tom: "bom", texto: `A ficha tem ${n0(eu.fotos)} fotos, acima da média dos concorrentes (${n0(m)}).` });
  }

  // Nota
  const notas = lista.map((x) => x.nota).filter((v): v is number => typeof v === "number");
  if (notas.length && eu.nota) {
    const m = notas.reduce((s, v) => s + v, 0) / notas.length;
    out.push(eu.nota >= m ? { titulo: "Nota", tom: "bom", texto: `Nota ${virg(eu.nota)}, acima da média dos concorrentes (${virg(m)}). É um diferencial para destacar nos anúncios e postagens.` } : { titulo: "Nota", tom: "ruim", texto: `Nota ${virg(eu.nota)}, abaixo da média dos concorrentes (${virg(m)}). Prioridade: responder as negativas e aumentar as avaliações de clientes satisfeitos.` });
  }

  // Posição
  if (c.posicao_categoria && c.posicao_categoria > 3) out.push({ titulo: "Posição no Maps", tom: "ruim", texto: `A ficha aparece em ${c.posicao_categoria}º na busca por "${c.palavra_concorrencia ?? c.info.categoria}" a partir do próprio endereço. Os 3 primeiros recebem a maior parte dos cliques.` });
  else if (!c.posicao_categoria) out.push({ titulo: "Posição no Maps", tom: "ruim", texto: `A ficha não aparece entre os 20 primeiros na busca por "${c.palavra_concorrencia ?? c.info.categoria}" a partir do próprio endereço.` });
  return out;
}

/** Exemplo para a prévia (sem conexão): números parecidos com uma ficha real bem cuidada. */
export function coletaDemo(nome = "Instituto de Educação Exemplo"): ColetaFicha {
  const agora = Date.now();
  const iso = (d: number) => new Date(agora - d * 864e5).toISOString().replace("T", " ").replace(/\.\d+Z$/, " +00:00");
  const textos = ["Escola acolhedora, equipe dedicada.", null, "Excelente ensino e muito carinho com as crianças!", null, "Melhor escolha que fizemos.", "Ambiente seguro e organizado.", null, "Professores excelentes."];
  const avaliacoes = Array.from({ length: 100 }, (_, i) => ({
    nota: i === 37 ? 4 : i === 81 ? 1 : 5,
    texto: textos[i % textos.length],
    autor: `${String.fromCharCode(65 + (i % 26))}.`,
    data: iso(8 + i * 4),
    respondida: i !== 81,
    resposta_data: i !== 81 ? iso(5 + i * 4) : null,
    fotos: i % 23 === 0 ? 1 : 0,
  }));
  const postagens = [3, 52, 79, 121, 121, 150, 203, 215].map((d, i) => ({ data: iso(d), texto: ["Algumas fases passam. Outras ficam para sempre na memória.", "Pequenas conquistas de hoje constroem grandes sonhos.", "Homenagem aos Pais 2026!", "Festa Cultural 2026: dois dias inesquecíveis."][i % 4], imagem: null, link: null }));
  return {
    info: {
      titulo: nome, categoria: "Instituição educacional", categorias_adicionais: ["Escola de ensino fundamental", "Pré-escola", "Escola particular"],
      descricao: "Bem-vindo! Fundado em 1996, oferecemos Educação Infantil e Ensino Fundamental em um ambiente acolhedor e educativo. Nossos diferenciais incluem excelência acadêmica, corpo docente qualificado e foco no desenvolvimento integral dos alunos. Venha nos conhecer e fazer parte da nossa história!",
      telefone: "+55 31 3367-0000", site: "https://exemplo.com.br/", nota: 5, avaliacoes: 123, distribuicao: { "1": 1, "2": 0, "3": 0, "4": 1, "5": 121 }, fotos: 90, reivindicado: true, perguntas: null,
      tem_horario: true, atributos: 2, servicos: 0, temas: { família: 18, filho: 15, alunos: 15, ensino: 13, carinho: 5, seguro: 5, dedicação: 4, parceria: 4 }, imagem: "x", logo: "x",
      place_id: "demo", cid: null, endereco: "R. Exemplo, 121 - Vila Ipanema, Ipatinga - MG", cidade: "Ipatinga", maps: null,
    },
    fotos_destaque: { total: 10, do_dono: 10 },
    horario_especial_proximos_dias: 0,
    concorrentes: [
      { nome: "Crescer Instituto Educacional", posicao: 1, nota: 4.9, avaliacoes: 213, categoria: "Instituição educacional", categorias_adicionais: ["Escola particular", "Escola de ensino fundamental", "Creche", "Escola de educação infantil"], fotos: 164, descricao_tam: 712, reivindicado: true, novas_30d: 11, distancia_km: 1.2 },
      { nome: "Sesi", posicao: 3, nota: 4.3, avaliacoes: 96, categoria: "Instituição educacional", categorias_adicionais: ["Escola de ensino médio"], fotos: 41, descricao_tam: 0, reivindicado: false, novas_30d: 2, distancia_km: 2.8 },
      { nome: "Instituto Educacional Avançar", posicao: 4, nota: 4.8, avaliacoes: 88, categoria: "Instituição educacional", categorias_adicionais: ["Escola particular", "Creche"], fotos: 77, descricao_tam: 420, reivindicado: true, novas_30d: 6, distancia_km: 3.1 },
      { nome: "Elite Instituição de Ensino", posicao: 5, nota: 4.6, avaliacoes: 34, categoria: "Escola mista", categorias_adicionais: ["Escola particular", "Escola de educação infantil"], fotos: 23, descricao_tam: 180, reivindicado: true, novas_30d: 1, distancia_km: 4.4 },
      { nome: "Enjoy Ipatinga", posicao: 6, nota: 4.3, avaliacoes: 127, categoria: "Escola de idiomas", categorias_adicionais: [], fotos: 58, descricao_tam: 310, reivindicado: true, novas_30d: 3, distancia_km: 2.0 },
    ],
    palavra_concorrencia: "Instituição educacional",
    posicao_categoria: 2,
    avaliacoes,
    postagens,
    custo: 0.0299,
    coletado_em: new Date(agora).toISOString(),
  };
}
