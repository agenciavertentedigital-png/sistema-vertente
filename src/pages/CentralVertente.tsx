import { useEffect, useRef, useState, type KeyboardEvent as KE, type MouseEvent as ME } from "react";
import { ArrowRight, ArrowUpRight, LogOut, Moon, Search, Sparkles, Sun } from "lucide-react";
import { ASSISTENTE, DASHBOARD, INTEGRACOES, SECOES, type Topico } from "../data/navegacao";
import simboloGrande from "../assets/simbolo-grande.png";
import simboloPrata from "../assets/simbolo-prata.png";

interface Props {
  ir: (r: string) => void;
  tema: "light" | "dark";
  alternarTema: () => void;
  usuario: { nome: string; papel: string };
  onSair?: () => void;
  abrirComando: () => void;
}

const GRUPOS: { id: string; nome: string; topicos: Topico[] }[] = [
  ...SECOES.map((s) => ({ id: s.id, nome: s.nome, topicos: s.topicos })),
  { id: "inteligencia", nome: "Inteligência e sistema", topicos: [ASSISTENTE, DASHBOARD, INTEGRACOES] },
];

const SUGESTOES = [
  "Quais tarefas estão atrasadas e com quem?",
  "Resuma o tráfego da semana por cliente",
  "Crie uma tarefa para revisar os criativos da Nobre Fio",
  "Como está a ficha do Google da Óticas Carol?",
];

function saudacao() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Central Vertente: a porta de entrada do sistema. Só ferramentas, sem números nem alertas. */
export function CentralVertente({ ir, tema, alternarTema, usuario, onSair, abrirComando }: Props) {
  const [pergunta, setPergunta] = useState("");
  const [dica, setDica] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const primeiroNome = usuario.nome.split(" ")[0];
  const iniciais = usuario.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    const t = setInterval(() => setDica((x) => (x + 1) % SUGESTOES.length), 4200);
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.key === "/" && !/input|textarea|select/i.test(alvo?.tagName ?? "") && !alvo?.isContentEditable) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function perguntar() {
    const q = pergunta.trim();
    if (!q) return ir("assistente");
    try {
      sessionStorage.setItem("vertente.pergunta", q);
    } catch {
      /* sem armazenamento: abre o assistente vazio */
    }
    ir("assistente");
  }

  let ordem = 0;
  return (
    <div className="central-v relative isolate min-h-[100dvh] overflow-hidden text-[#e9edff]">
      <FundoTecnologico />

      {/* Topo */}
      <header className="relative z-10 mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-[max(16px,env(safe-area-inset-left,0px))] sm:px-8">
        <div className="flex items-center gap-2.5">
          <img src={simboloPrata} alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
          <div className="leading-none">
            <div className="font-display text-[14px] font-bold tracking-[0.16em]">VERTENTE</div>
            <div className="mt-1 text-[8.5px] font-medium uppercase tracking-[0.3em] text-[#8f9bd6]">Digital · Sistema</div>
          </div>
        </div>
        <button onClick={abrirComando} className="cv-vidro ml-auto flex h-9 items-center gap-2 rounded-full px-3.5 text-[12.5px] text-[#aab4e8] hover:text-white sm:w-[260px]">
          <Search size={14} strokeWidth={1.8} />
          <span className="hidden flex-1 text-left sm:inline">Buscar no sistema</span>
          <kbd className="hidden rounded border border-white/10 px-1.5 text-[10.5px] text-[#8f9bd6] sm:inline">Ctrl K</kbd>
        </button>
        <button onClick={alternarTema} className="grid h-9 w-9 place-items-center rounded-full text-[#aab4e8] hover:bg-white/5 hover:text-white" aria-label={tema === "dark" ? "Usar tema claro no sistema" : "Usar tema escuro no sistema"} title={tema === "dark" ? "Tema claro no sistema" : "Tema escuro no sistema"}>
          {tema === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
        </button>
        <span className="hidden h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#4f6bff] to-[#22d3ee] text-[11px] font-bold text-[#050a1f] sm:grid" title={`${usuario.nome} · ${usuario.papel}`}>{iniciais}</span>
        {onSair && (
          <button onClick={onSair} className="grid h-9 w-9 place-items-center rounded-full text-[#aab4e8] hover:bg-white/5 hover:text-white" aria-label="Sair" title="Sair">
            <LogOut size={16} strokeWidth={1.8} />
          </button>
        )}
      </header>

      <main className="relative z-10 mx-auto flex max-w-[1240px] flex-col gap-14 px-[max(16px,env(safe-area-inset-left,0px))] pb-20 pt-10 sm:px-8 sm:pt-16">
        {/* Abertura */}
        <section className="cv-entrar flex flex-col items-center text-center" style={{ animationDelay: "60ms" }}>
          <span className="cv-vidro mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#aab4e8]">
            <span className="cv-pulso h-1.5 w-1.5 rounded-full bg-[#22d3ee]" /> Central Vertente
          </span>
          <h1 className="font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[52px]">
            {saudacao()}, <span className="cv-texto-gradiente">{primeiroNome}</span>.
          </h1>
          <p className="mt-3 max-w-[46ch] text-[14.5px] text-[#9aa5dc] sm:text-[16px]">Todas as ferramentas da Vertente em um só lugar. Escolha por onde começar ou peça à IA.</p>

          {/* Pergunta direto para a IA */}
          <div className="cv-borda-ia mt-8 w-full max-w-[640px] rounded-2xl p-px">
            <div className="flex items-center gap-2 rounded-2xl bg-[#070d2b]/90 py-1.5 pl-4 pr-1.5 backdrop-blur-xl">
              <Sparkles size={17} className="shrink-0 text-[#7dd3fc]" />
              <input
                ref={campo}
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                onKeyDown={(e: KE<HTMLInputElement>) => e.key === "Enter" && perguntar()}
                placeholder={SUGESTOES[dica]}
                aria-label="Pergunte à IA Vertente"
                className="h-11 min-w-0 flex-1 bg-transparent text-[14.5px] text-white outline-none placeholder:text-[#6f7bb8]"
              />
              <kbd className="mr-1 hidden rounded border border-white/10 px-1.5 text-[10.5px] text-[#6f7bb8] sm:inline">/</kbd>
              <button onClick={perguntar} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#4f6bff] to-[#22d3ee] text-[#050a1f] transition-transform hover:scale-105 active:scale-95" aria-label="Enviar para a IA">
                <ArrowRight size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </section>

        {/* Ferramentas */}
        <div className="flex flex-col gap-10">
          {GRUPOS.map((g) => (
            <section key={g.id} aria-labelledby={`cv-${g.id}`} className="flex flex-col gap-3">
              <h2 id={`cv-${g.id}`} className="cv-entrar flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7f8ac4]" style={{ animationDelay: `${120 + ordem * 40}ms` }}>
                {g.nome}
                <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
                {g.topicos.map((t) => {
                  ordem += 1;
                  return <Ferramenta key={t.id} t={t} n={ordem} ir={ir} />;
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11.5px] text-[#6f7bb8]">
          <span>Vertente Digital · Sistema próprio</span>
          <span className="hidden sm:inline">Ctrl K para buscar · / para perguntar à IA</span>
        </footer>
      </main>
    </div>
  );
}

/** Cartão de uma ferramenta: luz que segue o mouse e atalhos para as abas internas. */
function Ferramenta({ t, n, ir }: { t: Topico; n: number; ir: (r: string) => void }) {
  const Ic = t.icone;
  const ref = useRef<HTMLDivElement>(null);
  const mover = (e: ME<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !ref.current) return;
    ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={mover} className="cv-cartao cv-entrar group relative rounded-2xl hover:z-30 focus-within:z-30" style={{ animationDelay: `${160 + n * 35}ms`, ["--cor" as string]: t.cor }}>
      <button onClick={() => ir(t.rota)} className="relative z-[1] flex w-full flex-col gap-3 rounded-2xl p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc] sm:gap-4 sm:p-4">
        <div className="flex items-start justify-between">
          <span className="cv-icone relative grid h-10 w-10 place-items-center rounded-xl text-white sm:h-11 sm:w-11">
            <Ic size={20} strokeWidth={1.8} />
          </span>
          <span className="flex items-center gap-1 font-mono text-[10.5px] text-[#5d68a6]">
            {String(n).padStart(2, "0")}
            <ArrowUpRight size={14} className="text-[#aab4e8] opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </span>
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-tight text-white sm:text-[15px]">{t.nome}</div>
          <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#8f9ad3] sm:text-[12.5px]">{t.descricao}</div>
        </div>
      </button>
      {t.atalhos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-full z-20 hidden pt-1.5 opacity-0 transition-all duration-200 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 sm:block">
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0a1238]/95 p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {t.atalhos.slice(1).map((a) => (
              <button key={a.rota} onClick={() => ir(a.rota)} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-[#b8c1f0] hover:border-white/25 hover:bg-white/10 hover:text-white">
                {a.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Fundo: rede de partículas conectadas, luzes suaves e o símbolo da Vertente em destaque. */
function FundoTecnologico() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0;
    const mouse = { x: -9999, y: -9999 };
    let pontos: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const montar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const qtd = Math.min(95, Math.round((w * h) / 15000));
      pontos = Array.from({ length: qtd }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22, r: Math.random() * 1.4 + 0.5 }));
    };
    const desenhar = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pontos) {
        if (!reduzir) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }
      for (let i = 0; i < pontos.length; i++) {
        const a = pontos[i];
        for (let j = i + 1; j < pontos.length; j++) {
          const b = pontos[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = dx * dx + dy * dy;
          if (dist < 15000) {
            ctx.strokeStyle = `rgba(125, 150, 255, ${0.16 * (1 - dist / 15000)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const mx = a.x - mouse.x, my = a.y - mouse.y;
        const dm = mx * mx + my * my;
        if (dm < 26000) {
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.35 * (1 - dm / 26000)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        ctx.fillStyle = dm < 26000 ? "rgba(165, 243, 252, 0.95)" : "rgba(190, 204, 255, 0.55)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduzir && !document.hidden) raf = requestAnimationFrame(desenhar);
    };
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      if (reduzir) desenhar();
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) desenhar(); };
    montar();
    desenhar();
    const ro = new ResizeObserver(() => { montar(); if (reduzir) desenhar(); });
    ro.observe(c);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#040818]" />
      <div className="cv-luz absolute left-1/2 top-[-18%] h-[720px] w-[1100px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(56,84,255,0.32), transparent)" }} />
      <div className="cv-luz-2 absolute right-[-12%] top-[30%] h-[520px] w-[520px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(34,211,238,0.12), transparent)" }} />
      <div className="cv-luz-3 absolute bottom-[-10%] left-[-10%] h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(124,58,237,0.13), transparent)" }} />
      <div className="cv-grade absolute inset-0" />
      {/* Símbolo da Vertente com órbitas */}
      <div className="absolute left-1/2 top-[230px] -translate-x-1/2 -translate-y-1/2 sm:top-[260px]">
        <div className="relative grid h-[min(620px,92vw)] w-[min(620px,92vw)] place-items-center">
          <svg viewBox="0 0 200 200" className="cv-orbita absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="cv-g1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#7dd3fc" stopOpacity="0.55" /><stop offset="1" stopColor="#4f6bff" stopOpacity="0" /></linearGradient>
            </defs>
            <circle cx="100" cy="100" r="96" fill="none" stroke="url(#cv-g1)" strokeWidth="0.35" />
            <circle cx="100" cy="4" r="1.3" fill="#a5f3fc" />
          </svg>
          <svg viewBox="0 0 200 200" className="cv-orbita-2 absolute inset-[9%] h-[82%] w-[82%]">
            <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(165,180,255,0.18)" strokeWidth="0.3" strokeDasharray="1.2 3.6" />
            <circle cx="196" cy="100" r="1" fill="#c7d2fe" />
          </svg>
          <img src={simboloGrande} alt="" className="cv-simbolo relative h-[54%] w-[54%] object-contain" />
        </div>
      </div>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#040818] to-transparent" />
    </div>
  );
}
