// Dados de exemplo dos módulos novos (usados só na prévia, sem banco conectado).
import { DEMO_IDS } from "../lib/repo";
import { hoje, somarDias } from "../lib/tipos";
import { CRITERIOS, calcularNota, type AnaliseGmn, type CriterioAvaliado, type Nivel, type PerfilGmn } from "../lib/gmn";
import type { Post } from "../lib/social";
import type { Lancamento, ServicoCliente } from "../lib/financeiro";

const cli = (nome: string) => DEMO_IDS.get(nome) ?? "";
let semente = 11;
const acaso = () => {
  semente = (semente * 9301 + 49297) % 233280;
  return semente / 233280;
};

export function demoPerfis(): PerfilGmn[] {
  return [
    ["Clínica Nobre Fio", "Clínica de transplante capilar", "Ipatinga"],
    ["Óticas Carol SVA", "Ótica", "Ipatinga"],
    ["Espaço Larissa Lemos", "Salão de beleza", "Ipatinga"],
    ["Madalena Brandão", "Loja de roupas", "Coronel Fabriciano"],
    ["Essenza Planejados", "Loja de móveis planejados", "Ipatinga"],
  ].map(([nome, categoria, cidade], i) => ({
    id: `gp-${i + 1}`,
    cliente_id: cli(nome),
    nome,
    place_id: null,
    endereco: null,
    cidade,
    categoria,
    url_maps: null,
    palavras: [categoria.toLowerCase()],
    ativo: true,
  }));
}

export function demoAnalises(): AnaliseGmn[] {
  const out: AnaliseGmn[] = [];
  const base = [0.55, 0.8, 0.62, 0.35, 0.45];
  demoPerfis().forEach((p, i) => {
    for (let m = 3; m >= 0; m--) {
      const forca = Math.min(0.97, base[i] + (3 - m) * 0.06);
      const criterios: CriterioAvaliado[] = CRITERIOS.map((c) => ({ id: c.id, nivel: (acaso() < forca ? (acaso() < forca ? 2 : 1) : 0) as Nivel }));
      const data = somarDias(hoje(), -m * 30 - 3);
      out.push({
        id: `ga-${i}-${m}`,
        perfil_id: p.id,
        data,
        nota: calcularNota(criterios),
        criterios,
        dados: {
          nota_media: 4.2 + forca * 0.7,
          avaliacoes: Math.round(20 + forca * 180 + (3 - m) * 9),
          fotos: 10,
          ...(m === 0
            ? {
                completo: {
                  categorias: ["Ótica", "Loja de óculos de sol", "Optometrista"],
                  descricao_tamanho: 224,
                  reivindicado: true,
                  perguntas: null,
                  distribuicao: { "5": 131, "4": 9, "3": 3, "2": 1, "1": 4 },
                  temas: [["vendedores", 14], ["atendente", 12], ["educado", 10], ["consultor", 8], ["preço", 7], ["atenção", 7], ["simpáticas", 5]] as [string, number][],
                  fotos: 30,
                  atributos: 4,
                  servicos: 0,
                  respostas_pct: 35,
                  avaliacoes_lidas: 50,
                  avaliacoes_sem_resposta: [
                    { nota: 5, texto: "Ótimo atendimento!", autor: "Bruno M.", data: new Date(Date.now() - 864e5).toISOString(), respondida: false, resposta_data: null },
                    { nota: 2, texto: "Demoraram para entregar meus óculos, precisei voltar duas vezes.", autor: "Ana P.", data: new Date(Date.now() - 6 * 864e5).toISOString(), respondida: false, resposta_data: null },
                  ],
                  ultima_avaliacao: new Date(Date.now() - 864e5).toISOString(),
                  avaliacoes_30d: 11,
                  ultima_postagem: new Date(Date.now() - 7 * 864e5).toISOString(),
                  postagens_90d: 6,
                  postagens_recentes: [{ data: new Date(Date.now() - 7 * 864e5).toISOString(), texto: "Os pequenos também merecem enxergar o mundo com conforto e muito charme! Óculos infantis para o Dia das Crianças.", imagem: null, link: null }],
                  custo: 0.0129,
                },
              }
            : {}),
        },
        origem: "manual",
        observacoes: null,
      });
    }
  });
  return out;
}

export function demoPosts(): Post[] {
  const clientes = ["Clínica Nobre Fio", "Madalena Brandão", "Espaço Larissa Lemos", "Óticas Carol SVA", "Cecy Lessa"];
  const temas = ["Antes e depois", "Dica da semana", "Bastidores", "Depoimento de cliente", "Oferta do mês", "Novidade na loja", "Perguntas frequentes", "Lançamento"];
  const formatos: Post["formato"][] = ["feed", "carrossel", "reels", "stories"];
  const out: Post[] = [];
  const h = hoje();
  for (let d = -12; d <= 20; d++) {
    const data = somarDias(h, d);
    const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
    if (dow === 0) continue;
    clientes.forEach((c, i) => {
      if ((d + i * 3) % 4 !== 0) return;
      const status: Post["status"] = d < -2 ? "publicado" : d < 0 ? (acaso() < 0.7 ? "publicado" : "aprovado") : d < 4 ? (["aprovacao", "aprovado", "ajuste"] as const)[Math.floor(acaso() * 3)] : d < 10 ? "producao" : "ideia";
      out.push({
        id: `po-${d}-${i}`,
        cliente_id: cli(c),
        data,
        formato: formatos[Math.floor(acaso() * 4)],
        tema: temas[Math.floor(acaso() * temas.length)],
        legenda: null,
        status,
        responsavel_id: null,
        link_material: null,
        link_publicado: null,
        observacoes: null,
      });
    });
  }
  return out;
}

const VALORES: [string, string, number][] = [
  ["Clínica Nobre Fio", "trafego_meta", 1800],
  ["Clínica Nobre Fio", "gmn", 400],
  ["Madalena Brandão", "trafego_meta", 1200],
  ["Madalena Brandão", "social_media", 900],
  ["Espaço Larissa Lemos", "trafego_meta", 1000],
  ["Óticas Carol SVA", "trafego_meta", 1500],
  ["Óticas Carol SVA", "gmn", 350],
  ["Essenza Planejados", "trafego_meta", 1100],
  ["Cecy Lessa", "trafego_meta", 900],
  ["CDT Porto Seguro", "trafego_meta", 1300],
  ["Advocacia Djalmas", "trafego_google", 1200],
];

export function demoServicos(): ServicoCliente[] {
  return VALORES.map(([c, s, v]) => ({ id: `${cli(c)}|${s}`, cliente_id: cli(c), servico_codigo: s, valor_mensal: v, inicio: null }));
}

export function demoLancamentos(): Lancamento[] {
  const out: Lancamento[] = [];
  const h = hoje();
  const totais = new Map<string, number>();
  VALORES.forEach(([c, , v]) => totais.set(c, (totais.get(c) ?? 0) + v));
  for (let m = 5; m >= 0; m--) {
    const d = new Date(`${h.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - m);
    const comp = d.toISOString().slice(0, 10);
    let i = 0;
    for (const [c, v] of totais) {
      i++;
      const venc = `${comp.slice(0, 8)}${String(5 + (i % 4) * 5).padStart(2, "0")}`;
      const pago = m > 0 ? (acaso() < 0.93 ? somarDias(venc, Math.floor(acaso() * 4)) : null) : venc < h && acaso() < 0.7 ? venc : null;
      out.push({ id: `lr-${m}-${i}`, tipo: "receita", cliente_id: cli(c), descricao: `Mensalidade ${c}`, categoria: "Mensalidade", valor: v, competencia: comp, vencimento: venc, pago_em: pago, forma: "pix", observacoes: null });
    }
    const despesas: [string, string, number][] = [
      ["Pró-labore", "Pró-labore", 5000],
      ["Ferramentas (Reportei, ClickUp, Canva…)", "Ferramentas", 680 + Math.round(acaso() * 120)],
      ["Aluguel e escritório", "Escritório", 1200],
      ["DAS - Simples Nacional", "Jurídico e contábil", 900 + Math.round(acaso() * 200)],
      ["Freelancers", "Mão de obra", Math.round(acaso() * 1500)],
    ];
    despesas.forEach(([desc, cat, v], k) => {
      const venc = `${comp.slice(0, 8)}${String(5 + k * 4).padStart(2, "0")}`;
      out.push({ id: `ld-${m}-${k}`, tipo: "despesa", cliente_id: null, descricao: desc, categoria: cat, valor: v, competencia: comp, vencimento: venc, pago_em: m > 0 || venc < h ? venc : null, forma: null, observacoes: null });
    });
  }
  return out;
}
