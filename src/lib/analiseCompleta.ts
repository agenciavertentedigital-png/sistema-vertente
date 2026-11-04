// Análise completa de ficha gerenciada (dados do dono pela API oficial do Perfil da Empresa)
// e os cálculos do Relatório Avançado (avaliações, métricas, engajamento, postagens e mídia).

export interface MidiaG { formato: string; categoria: string | null; data: string; largura: number | null; altura: number | null; url: string | null }
export interface AvaliacaoC { nota: number | null; texto: string; autor: string; data: string; resposta: string | null; resposta_data: string | null }
export interface PostagemC { data: string; tipo: string; texto: string; estado: string; cta: string | null; midia: number; url: string | null }
export interface ColetaCompleta {
  coletado_em: string;
  local: { nome: string; place_id: string; maps: string | null; cidade: string | null };
  ficha: {
    nome: string;
    descricao: string | null;
    categoria: string | null;
    categorias_extras: string[];
    telefone: string | null;
    site: string | null;
    endereco: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string; sublocality?: string } | null;
    horario: { periods?: { openDay: string; closeDay: string; openTime?: { hours?: number; minutes?: number }; closeTime?: { hours?: number; minutes?: number } }[] } | null;
    horario_especial: { specialHourPeriods?: { startDate: { year: number; month: number; day: number } }[] } | null;
    servicos: unknown[];
    fundacao: { year?: number; month?: number; day?: number } | null;
    status: string | null;
    maps: string | null;
    tem_mensagens: boolean | null;
    atributos: { nome: string; valores: unknown[] | null; urls: { uri: string }[] | null }[];
    verificada: boolean | null;
    problema: string | null;
  };
  midia_dono: MidiaG[];
  midia_dono_total: number | null;
  midia_clientes: MidiaG[];
  midia_clientes_total: number | null;
  avaliacoes: AvaliacaoC[];
  avaliacoes_total: number | null;
  avaliacoes_media: number | null;
  postagens: PostagemC[];
  dias: ({ data: string } & Record<string, number>)[];
  avisos: string[];
}

export type Faixa = "fraco" | "razoavel" | "bom";
export interface ItemCompleto { id: string; nome: string; porque: string; pct: number; texto: string }

export const faixaItem = (pct: number): Faixa => (pct >= 75 ? "bom" : pct >= 40 ? "razoavel" : "fraco");
export const faixaNota = (n: number): Faixa => (n >= 80 ? "bom" : n >= 55 ? "razoavel" : "fraco");
export const COR_FAIXA: Record<Faixa, string> = { fraco: "#e04b3c", razoavel: "#f2b705", bom: "#1aa361" };
export const NOME_FAIXA: Record<Faixa, string> = { fraco: "Fraco", razoavel: "Razoável", bom: "Bom" };

const diasDesde = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);
const REDES = /(^|\/\/|\.)(facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|tiktok\.com|wa\.me|api\.whatsapp\.com|linktr\.ee)(\/|$)/i;
const valida = (m: MidiaG) => !m.data.startsWith("1970");

/** Os 21 itens da análise completa, com as mesmas regras de referência do mercado. */
export function avaliarCompleta(c: ColetaCompleta): ItemCompleto[] {
  const f = c.ficha;
  const av = c.avaliacoes;
  const total = Number(c.avaliacoes_total ?? av.length);
  const media = Number(c.avaliacoes_media ?? 0);
  const videos = [...c.midia_dono, ...c.midia_clientes].filter((m) => m.formato === "VIDEO").length;
  const cli = Number(c.midia_clientes_total ?? c.midia_clientes.length);
  const dono = Number(c.midia_dono_total ?? c.midia_dono.length);
  const ultMidia = c.midia_dono.filter(valida).map((m) => m.data).sort().pop() ?? null;
  const ultPost = c.postagens.map((p) => p.data).sort().pop() ?? null;
  const ano = new Date().getFullYear();
  const especial = (f.horario_especial?.specialHourPeriods ?? []).some((p) => p.startDate?.year === ano);
  const semResp = av.filter((a) => !a.resposta).length;
  const comTexto = av.filter((a) => a.texto.trim()).length;
  const recentes = av.slice(0, 7).filter((a) => a.nota);
  const mediaRecente = recentes.length ? recentes.reduce((s, a) => s + (a.nota ?? 0), 0) / recentes.length : null;
  const nome = f.nome ?? "";
  const dP = diasDesde(ultPost);
  const dM = diasDesde(ultMidia);
  const v = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  const itens: ItemCompleto[] = [
    { id: "midia_clientes", nome: "Mídias publicadas por clientes", porque: "Fotos de clientes provam que o negócio é real e geram confiança.", pct: cli >= 3 ? 100 : cli > 0 ? 50 : 0, texto: cli ? `${cli} mídia${cli > 1 ? "s" : ""} publicadas por clientes. Recomendado: 3 ou mais.` : "Ainda não existe mídia publicada por clientes. Quantidade recomendada: 3." },
    { id: "videos", nome: "Mídia - Vídeos", porque: "Vídeos atraem e fidelizam mais do que outros formatos.", pct: videos >= 3 ? 100 : videos > 0 ? 50 : 0, texto: videos ? `${videos} vídeo${videos > 1 ? "s" : ""}. Mínimo recomendado: 3.` : "Não existem vídeos. Quantidade mínima recomendada: 3." },
    { id: "qtd_avaliacoes", nome: "Avaliações - Quantidade", porque: "Uma quantidade mínima de avaliações transmite segurança.", pct: total >= 3 ? 100 : total > 0 ? 50 : 0, texto: `Quantidade atual: ${total}. Mínimo recomendado: 3.` },
    { id: "descricao", nome: "Descrição da empresa", porque: "Conta a história do negócio e o que o torna único.", pct: (f.descricao?.length ?? 0) >= 50 ? 100 : f.descricao ? 50 : 0, texto: f.descricao ? `Descrição com ${f.descricao.length} caracteres. Mínimo recomendado: 50 (ideal 400 a 750).` : "A ficha não tem descrição." },
    { id: "horario_especial", nome: "Horário especial", porque: "Informa feriados e mudanças breves sem alterar o horário normal.", pct: especial ? 100 : 0, texto: especial ? `Possui horário especial definido para ${ano}.` : `Não há horário especial definido para ${ano} (feriados).` },
    { id: "logo", nome: "Mídia - Logotipo", porque: "Ajuda o cliente a reconhecer a marca no Google.", pct: c.midia_dono.some((m) => m.categoria === "PROFILE" || m.categoria === "LOGO") ? 100 : 0, texto: c.midia_dono.some((m) => m.categoria === "PROFILE" || m.categoria === "LOGO") ? "Existe uma imagem de logotipo definida." : "Não há logotipo definido." },
    { id: "media_avaliacoes", nome: "Avaliações - Média", porque: "Uma boa média transmite segurança para o cliente.", pct: !total ? 0 : media >= 4.5 ? 100 : media >= 4 ? 50 : 0, texto: total ? `Média de ${v(media)} estrelas${media >= 4.5 ? ", dentro do esperado" : ". Recomendado: 4,5 ou mais"}.` : "Sem avaliações." },
    { id: "sem_comentarios", nome: "Avaliações sem comentários", porque: "Avaliações com texto valem mais para quem está decidindo.", pct: !av.length ? 0 : comTexto / av.length >= 0.5 ? 100 : comTexto / av.length >= 0.25 ? 50 : 0, texto: av.length ? `${comTexto} de ${av.length} avaliações têm comentário (${Math.round((comTexto / av.length) * 100)}%).` : "Sem avaliações." },
    { id: "sem_resposta", nome: "Avaliações sem resposta", porque: "Responder mostra que a empresa se importa com o cliente.", pct: !av.length ? 100 : semResp === 0 ? 100 : semResp / av.length <= 0.1 ? 50 : 0, texto: semResp ? `${semResp} avaliação${semResp > 1 ? "ões" : ""} sem resposta de ${av.length}.` : `Todas as avaliações estão respondidas (${av.length}).` },
    {
      id: "tendencia", nome: "Avaliações - Comparativo (tendência)", porque: "Mostra se as avaliações recentes estão melhores ou piores que a média.",
      pct: total < 10 || mediaRecente === null ? 100 : mediaRecente >= media - 0.2 ? 100 : mediaRecente >= media - 0.5 ? 50 : 0,
      texto: total < 10 || mediaRecente === null ? "Ainda não há avaliações suficientes para comparar períodos." : `Média das últimas ${recentes.length}: ${v(mediaRecente)} · média geral: ${v(media)}. ${mediaRecente >= media - 0.2 ? "Estável ou subindo." : "Em queda."}`,
    },
    { id: "servicos", nome: "Serviços", porque: "Serviços ajudam a aparecer em mais buscas e explicam o que a empresa faz.", pct: f.servicos.length ? 100 : 0, texto: f.servicos.length ? `${f.servicos.length} ${f.servicos.length > 1 ? "serviços cadastrados" : "serviço cadastrado"}.` : "Nenhum serviço cadastrado." },
    { id: "ultima_postagem", nome: "Data da última postagem", porque: "Postar mostra ao Google que o negócio está ativo.", pct: dP === null ? 0 : dP <= 30 ? 100 : dP <= 60 ? 50 : 0, texto: dP === null ? "Não há postagens. Recomendado: pelo menos 1 a cada 30 dias." : `Última postagem há ${dP} dia${dP === 1 ? "" : "s"}. Máximo recomendado: 30 dias.` },
    { id: "fundacao", nome: "Data de fundação", porque: "Mostra a história e a solidez do negócio.", pct: f.fundacao?.year ? 100 : 0, texto: f.fundacao?.year ? `Fundada em ${f.fundacao.month ? `${String(f.fundacao.month).padStart(2, "0")}/` : ""}${f.fundacao.year}.` : "Sem data de fundação." },
    { id: "nome", nome: "Nome do negócio", porque: "Deve ser o nome real, como na fachada e no site.", pct: !nome ? 0 : nome.length <= 98 ? 100 : 50, texto: `${nome.length} caracteres. Máximo recomendado: 98.` },
    { id: "telefone", nome: "Número de telefone", porque: "Informação-chave para o cliente entrar em contato.", pct: f.telefone ? 100 : 0, texto: f.telefone ? `Telefone: ${f.telefone}.` : "Sem telefone." },
    { id: "midia_dono", nome: "Mídia do proprietário", porque: "Fotos do dono mostram o negócio como ele quer ser visto.", pct: dono >= 3 ? 100 : dono > 0 ? 50 : 0, texto: `Quantidade atual: ${dono}. Mínimo recomendado: 3.` },
    { id: "midia_total", nome: "Quantidade total de mídia", porque: "Uma galeria completa melhora a experiência do cliente.", pct: dono + cli >= 3 ? 100 : dono + cli > 0 ? 50 : 0, texto: `Quantidade atual: ${dono + cli}. Mínimo recomendado: 3.` },
    { id: "website", nome: "Website", porque: "Site próprio dá credibilidade. Rede social não substitui site.", pct: !f.site ? 0 : REDES.test(f.site) ? 50 : 100, texto: !f.site ? "Sem site." : REDES.test(f.site) ? `O site cadastrado é uma rede social (${f.site}). O Google recomenda domínio próprio.` : `Site: ${f.site}.` },
    { id: "capa", nome: "Mídia - Foto de capa", porque: "A capa costuma ser a foto principal da ficha.", pct: c.midia_dono.some((m) => m.categoria === "COVER") ? 100 : 0, texto: c.midia_dono.some((m) => m.categoria === "COVER") ? "Possui foto de capa." : "Sem foto de capa definida." },
    { id: "ultima_midia", nome: "Data da última mídia do proprietário", porque: "Fotos novas mostram que o perfil está ativo.", pct: dM === null ? 0 : dM <= 30 ? 100 : dM <= 60 ? 50 : 0, texto: dM === null ? "Sem fotos do proprietário." : `Última foto há ${dM} dia${dM === 1 ? "" : "s"}. Máximo recomendado: 30 dias.` },
    { id: "horario", nome: "Horário de funcionamento", porque: "O cliente precisa saber quando pode ir ou ligar.", pct: f.horario?.periods?.length ? 100 : 0, texto: f.horario?.periods?.length ? "Horário de funcionamento definido." : "Sem horário de funcionamento." },
  ];
  return itens.sort((a, b) => a.pct - b.pct);
}

export const notaCompleta = (itens: ItemCompleto[]) => (itens.length ? Math.round(itens.reduce((s, i) => s + i.pct, 0) / itens.length) : 0);

export function interpretacao(nota: number) {
  if (nota >= 80) return { texto: `Com nota ${nota}, o perfil está muito bem otimizado, acima da média do mercado, com mais visibilidade e confiança.`, passos: ["Continuar monitorando e atualizando o perfil", "Responder todas as avaliações", "Publicar postagens e fotos novas todo mês"] };
  if (nota >= 55) return { texto: `Com nota ${nota}, o perfil está razoável: já tem o básico, mas perde visibilidade nos itens em vermelho e amarelo.`, passos: ["Resolver primeiro os itens em vermelho", "Criar rotina de postagens e fotos", "Pedir avaliações com comentário aos clientes"] };
  return { texto: `Com nota ${nota}, o perfil precisa de atenção: faltam informações importantes e o Google tende a mostrar concorrentes antes.`, passos: ["Completar descrição, categorias, horários e serviços", "Publicar fotos, capa e logotipo", "Começar a pedir e responder avaliações"] };
}

// ------------------------------------------------------------------
// Relatório avançado
// ------------------------------------------------------------------
const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const diaSemana = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).getUTCDay();
const mesDe = (iso: string) => iso.slice(0, 7);

export function relatorioAvaliacoes(c: ColetaCompleta) {
  const av = c.avaliacoes.filter((a) => a.nota);
  const total = av.length;
  const pos = av.filter((a) => (a.nota ?? 0) >= 4).length;
  const neg = av.filter((a) => (a.nota ?? 0) <= 2).length;
  const neu = total - pos - neg;
  const isr = total ? ((pos - neg) / total) * 100 : 0;
  const respondidas = av.filter((a) => a.resposta).length;
  const comTexto = av.filter((a) => a.texto.trim());
  const dist = [5, 4, 3, 2, 1].map((n) => ({ nota: n, qtd: av.filter((a) => a.nota === n).length, respondidas: av.filter((a) => a.nota === n && a.resposta).length, com_texto: av.filter((a) => a.nota === n && a.texto.trim()).length }));
  const porMes = new Map<string, { qtd: number; soma: number }>();
  for (const a of av) {
    const k = mesDe(a.data);
    const x = porMes.get(k) ?? { qtd: 0, soma: 0 };
    x.qtd++;
    x.soma += a.nota ?? 0;
    porMes.set(k, x);
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
  let acum = 0;
  const acumulado = meses.map(([mes, x]) => ({ mes, total: (acum += x.qtd) }));
  const semana = DIAS_SEMANA.map((d, i) => ({ dia: d, qtd: av.filter((a) => diaSemana(a.data) === i).length }));
  const palavras = comTexto.map((a) => a.texto.trim().split(/\s+/).length);
  const tempos = av.filter((a) => a.resposta_data).map((a) => (new Date(a.resposta_data!).getTime() - new Date(a.data).getTime()) / 864e5).filter((x) => x >= 0);
  return {
    total: Number(c.avaliacoes_total ?? total),
    media: Number(c.avaliacoes_media ?? (total ? av.reduce((s, a) => s + (a.nota ?? 0), 0) / total : 0)),
    positivas: pos, neutras: neu, negativas: neg, isr,
    taxa_resposta: total ? respondidas / total : 0,
    com_comentario: total ? comTexto.length / total : 0,
    distribuicao: dist,
    por_mes: meses.map(([mes, x]) => ({ mes, qtd: x.qtd, media: x.soma / x.qtd })).slice(-18),
    acumulado: acumulado.slice(-18),
    por_semana: semana,
    media_caracteres: comTexto.length ? Math.round(comTexto.reduce((s, a) => s + a.texto.length, 0) / comTexto.length) : 0,
    media_palavras: palavras.length ? Math.round(palavras.reduce((s, x) => s + x, 0) / palavras.length) : 0,
    tempo_resposta_dias: tempos.length ? tempos.sort((a, b) => a - b)[Math.floor(tempos.length / 2)] : null,
  };
}

export function relatorioMetricas(c: ColetaCompleta) {
  const d = c.dias;
  const s = (k: string) => d.reduce((t, x) => t + (x[k] ?? 0), 0);
  const buscaMob = s("BUSINESS_IMPRESSIONS_MOBILE_SEARCH"), buscaDesk = s("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH");
  const mapaMob = s("BUSINESS_IMPRESSIONS_MOBILE_MAPS"), mapaDesk = s("BUSINESS_IMPRESSIONS_DESKTOP_MAPS");
  const vis = buscaMob + buscaDesk + mapaMob + mapaDesk;
  const lig = s("CALL_CLICKS"), site = s("WEBSITE_CLICKS"), rotas = s("BUSINESS_DIRECTION_REQUESTS"), conv = s("BUSINESS_CONVERSATIONS"), reservas = s("BUSINESS_BOOKINGS");
  const acoes = lig + site + rotas + conv + reservas;
  const visDia = (x: Record<string, number>) => (x.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0) + (x.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) + (x.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0) + (x.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0);
  const acaoDia = (x: Record<string, number>) => (x.CALL_CLICKS ?? 0) + (x.WEBSITE_CLICKS ?? 0) + (x.BUSINESS_DIRECTION_REQUESTS ?? 0) + (x.BUSINESS_CONVERSATIONS ?? 0) + (x.BUSINESS_BOOKINGS ?? 0);
  const semanaVis = DIAS_SEMANA.map((dia, i) => ({ dia, valor: d.filter((x) => diaSemana(x.data) === i).reduce((t, x) => t + visDia(x), 0) }));
  const semanaAcoes = DIAS_SEMANA.map((dia, i) => ({ dia, valor: d.filter((x) => diaSemana(x.data) === i).reduce((t, x) => t + acaoDia(x), 0) }));
  type MesM = { vis: number; acoes: number; lig: number; site: number; rotas: number; conv: number };
  const mesesMap = new Map<string, MesM>();
  for (const x of d) {
    const k = mesDe(x.data);
    const m = mesesMap.get(k) ?? { vis: 0, acoes: 0, lig: 0, site: 0, rotas: 0, conv: 0 };
    m.vis += visDia(x); m.acoes += acaoDia(x); m.lig += x.CALL_CLICKS ?? 0; m.site += x.WEBSITE_CLICKS ?? 0; m.rotas += x.BUSINESS_DIRECTION_REQUESTS ?? 0; m.conv += x.BUSINESS_CONVERSATIONS ?? 0;
    mesesMap.set(k, m);
  }
  const meses = [...mesesMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, m]) => ({ mes, ...m }));
  const acoesLista = [{ nome: "Rotas", valor: rotas }, { nome: "Ligações", valor: lig }, { nome: "Cliques no site", valor: site }, { nome: "Conversas", valor: conv }, { nome: "Reservas", valor: reservas }].filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
  const interesse = vis ? acoes / vis : 0;
  const stats = (k: "lig" | "site" | "rotas" | "conv") => {
    const xs = meses.map((m) => m[k]);
    return { media: xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0, max: xs.length ? Math.max(...xs) : 0, min: xs.length ? Math.min(...xs) : 0 };
  };
  return {
    inicio: d[0]?.data ?? null, fim: d[d.length - 1]?.data ?? null, dias: d.length,
    visualizacoes: vis, busca: buscaMob + buscaDesk, mapa: mapaMob + mapaDesk,
    plataforma: { busca_mobile: buscaMob, busca_desktop: buscaDesk, mapa_mobile: mapaMob, mapa_desktop: mapaDesk },
    mobile: vis ? (buscaMob + mapaMob) / vis : 0, desktop: vis ? (buscaDesk + mapaDesk) / vis : 0,
    acoes, ligacoes: lig, site, rotas, conversas: conv, reservas, interesse,
    engajamento: Math.min(100, Math.round(interesse * 120)),
    acoes_lista: acoesLista,
    principal_fonte: buscaMob + buscaDesk >= mapaMob + mapaDesk ? "Google Pesquisa" : "Google Maps",
    dia_mais_ativo: [...semanaVis].sort((a, b) => b.valor - a.valor)[0]?.dia ?? "—",
    semana_vis: semanaVis, semana_acoes: semanaAcoes, meses,
    stats: { lig: stats("lig"), site: stats("site"), rotas: stats("rotas"), conv: stats("conv") },
  };
}

const TIPO_POST: Record<string, string> = { STANDARD: "Atualização", OFFER: "Oferta", EVENT: "Evento", ALERT: "Alerta" };
const CTA: Record<string, string> = { BOOK: "Reservar", ORDER: "Fazer pedido", SHOP: "Comprar", LEARN_MORE: "Saiba mais", SIGN_UP: "Inscrever-se", CALL: "Ligar" };
export function relatorioPostagens(c: ColetaCompleta) {
  const ps = [...c.postagens].sort((a, b) => a.data.localeCompare(b.data));
  const datas = ps.map((p) => new Date(p.data).getTime());
  const gaps: { de: string; ate: string; dias: number }[] = [];
  for (let i = 1; i < ps.length; i++) gaps.push({ de: ps[i - 1].data, ate: ps[i].data, dias: Math.round((datas[i] - datas[i - 1]) / 864e5) });
  const ult = ps[ps.length - 1]?.data ?? null;
  const desdeUlt = diasDesde(ult);
  if (ult && (desdeUlt ?? 0) > 0) gaps.push({ de: ult, ate: new Date().toISOString(), dias: desdeUlt ?? 0 });
  const conta = (dias: number) => ps.filter((p) => (diasDesde(p.data) ?? 9999) <= dias).length;
  const porMes = new Map<string, number>();
  for (const p of ps) porMes.set(mesDe(p.data), (porMes.get(mesDe(p.data)) ?? 0) + 1);
  const tipos = new Map<string, number>();
  for (const p of ps) tipos.set(TIPO_POST[p.tipo] ?? p.tipo, (tipos.get(TIPO_POST[p.tipo] ?? p.tipo) ?? 0) + 1);
  const ctas = new Map<string, number>();
  for (const p of ps) if (p.cta) ctas.set(CTA[p.cta] ?? p.cta, (ctas.get(CTA[p.cta] ?? p.cta) ?? 0) + 1);
  const intervalos = gaps.slice(0, ps.length - 1).map((g) => g.dias);
  const ult30 = conta(30);
  return {
    total: ps.length,
    ultima: ult,
    frequencia: ult30 >= 4 ? "Muito ativo" : ult30 >= 2 ? "Ativo" : ult30 === 1 ? "Pouco ativo" : "Inativo",
    intervalo_medio: intervalos.length ? Math.round(intervalos.reduce((s, x) => s + x, 0) / intervalos.length) : null,
    caracteres: ps.length ? Math.round(ps.reduce((s, p) => s + p.texto.length, 0) / ps.length) : 0,
    com_midia: ps.length ? ps.filter((p) => p.midia > 0).length / ps.length : 0,
    com_cta: ps.length ? ps.filter((p) => p.cta).length / ps.length : 0,
    ult_30: ult30, ult_90: conta(90), ult_180: conta(180), ult_365: conta(365),
    maiores_pausas: gaps.filter((g) => g.dias > 30).sort((a, b) => b.dias - a.dias).slice(0, 5),
    por_mes: [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mes, qtd]) => ({ mes, qtd })),
    tipos: [...tipos.entries()].map(([nome, qtd]) => ({ nome, qtd })),
    ctas: [...ctas.entries()].map(([nome, qtd]) => ({ nome, qtd })),
    lista: [...ps].reverse().slice(0, 10),
  };
}

export function relatorioMidia(c: ColetaCompleta) {
  const dono = c.midia_dono.filter(valida);
  const qual = (m: MidiaG) => {
    const lado = Math.max(m.largura ?? 0, m.altura ?? 0);
    const outro = Math.min(m.largura ?? 0, m.altura ?? 0);
    if (!lado) return "sem";
    if (lado >= 1920 && outro >= 1080) return "alta";
    if (lado >= 1280 && outro >= 720) return "media";
    return "baixa";
  };
  const qtd = (q: string) => dono.filter((m) => m.formato === "PHOTO" && qual(m) === q).length;
  const porMes = new Map<string, number>();
  for (const m of dono) porMes.set(mesDe(m.data), (porMes.get(mesDe(m.data)) ?? 0) + 1);
  return {
    total: Number(c.midia_dono_total ?? dono.length) + Number(c.midia_clientes_total ?? c.midia_clientes.length),
    dono_fotos: c.midia_dono.filter((m) => m.formato === "PHOTO").length,
    dono_videos: c.midia_dono.filter((m) => m.formato === "VIDEO").length,
    clientes_fotos: c.midia_clientes.filter((m) => m.formato === "PHOTO").length,
    clientes_videos: c.midia_clientes.filter((m) => m.formato === "VIDEO").length,
    qualidade: { alta: qtd("alta"), media: qtd("media"), baixa: qtd("baixa") },
    recentes: [...dono].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8),
    por_mes: [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mes, qtd]) => ({ mes, qtd })),
  };
}
