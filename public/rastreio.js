/*!
 * Rastreio Vertente · v1
 * Guarda de onde a pessoa veio (UTMs, gclid, gbraid, wbraid, fbclid, _fbc/_fbp) e troca os botões de WhatsApp
 * do site pelo link rastreado do cliente. Cada clique gera um código que vai escondido na primeira mensagem.
 *
 * Instalação (antes de </body>):
 *   <script src="https://sistema.agenciavertente.com.br/rastreio.js" data-link="SLUG-DO-LINK" async></script>
 * Botão específico com outro link: <a href="https://wa.me/55..." data-vt-link="outro-slug">
 * Uso manual (formulários, botões feitos em JS): window.VertenteRastreio.abrir("slug")
 */
(function () {
  "use strict";
  if (window.VertenteRastreio) return;
  var script = document.currentScript || document.querySelector('script[src*="rastreio.js"]');
  var base = (script && script.src ? new URL(script.src).origin : "https://sistema.agenciavertente.com.br");
  var padrao = script ? script.getAttribute("data-link") : null;
  var CHAVES = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "campaign_id", "adset_id", "ad_id", "gclid", "gbraid", "wbraid", "fbclid"];
  var DIAS = 30 * 864e5;

  function ler(chave) {
    try {
      var v = JSON.parse(localStorage.getItem(chave) || "null");
      return v && v.em && Date.now() - v.em < DIAS ? v : null;
    } catch (e) {
      return null;
    }
  }
  function gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {}
  }
  function cookie(nome) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + nome + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  // 1) Guarda a origem desta visita (último toque) e a primeira origem conhecida (primeiro toque)
  var busca = new URLSearchParams(location.search);
  var params = {};
  var tem = false;
  CHAVES.forEach(function (k) {
    var v = busca.get(k);
    if (v) {
      params[k] = v.slice(0, 300);
      tem = true;
    }
  });
  var visita = { params: params, pagina: location.href.slice(0, 500), referencia: document.referrer ? document.referrer.slice(0, 500) : null, em: Date.now() };
  var externa = document.referrer && document.referrer.indexOf(location.hostname) === -1;
  if (tem || (externa && !ler("vt_ultimo"))) gravar("vt_ultimo", visita);
  if (!ler("vt_primeiro") && (tem || externa)) gravar("vt_primeiro", visita);
  // fbc a partir do fbclid, como o Pixel faz (ajuda a Meta a casar a conversão)
  if (params.fbclid && !cookie("_fbc")) {
    try {
      document.cookie = "_fbc=fb.1." + Date.now() + "." + params.fbclid + "; path=/; max-age=7776000; SameSite=Lax";
    } catch (e) {}
  }

  // 2) Pede o link rastreado e abre o WhatsApp
  function abrir(slug, reserva, novaAba) {
    if (!slug) {
      if (reserva) location.href = reserva;
      return;
    }
    var ultimo = ler("vt_ultimo") || visita;
    var janela = novaAba ? window.open("", "_blank") : null;
    var feito = false;
    function ir(url) {
      if (feito) return;
      feito = true;
      if (janela) janela.location.href = url;
      else location.href = url;
    }
    var limite = setTimeout(function () {
      ir(reserva || base + "/r/" + encodeURIComponent(slug));
    }, 2500);
    fetch(base + "/r", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s: slug, params: ultimo.params || {}, pagina: location.href.slice(0, 500), referencia: ultimo.referencia, primeiro_toque: ler("vt_primeiro"), fbc: cookie("_fbc"), fbp: cookie("_fbp") }),
      keepalive: true,
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        clearTimeout(limite);
        ir(j && j.url ? j.url : reserva || base + "/r/" + encodeURIComponent(slug));
      })
      .catch(function () {
        clearTimeout(limite);
        ir(reserva || base + "/r/" + encodeURIComponent(slug));
      });
  }

  // 3) Intercepta cliques em links de WhatsApp (wa.me, api.whatsapp.com, whatsapp://) e nos links /r/
  var WHATS = /^(https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)|whatsapp:\/\/)/i;
  document.addEventListener(
    "click",
    function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest("a[href], [data-vt-link]") : null;
      if (!a || ev.defaultPrevented || ev.button > 0 || ev.metaKey || ev.ctrlKey) return;
      var href = a.getAttribute("href") || "";
      if (/chat\.whatsapp\.com/i.test(href)) return; // convite de grupo: não mexe
      var proprio = href.match(/\/r\/([a-z0-9-]{3,40})/i);
      var slug = a.getAttribute("data-vt-link") || (proprio && href.indexOf(base) === 0 ? proprio[1] : null) || (WHATS.test(href) ? padrao : null);
      if (!slug) return;
      ev.preventDefault();
      abrir(slug.toLowerCase(), WHATS.test(href) ? href : null, a.getAttribute("target") === "_blank");
    },
    true,
  );

  window.VertenteRastreio = { abrir: function (slug) { abrir(slug || padrao, null, false); }, origem: function () { return ler("vt_ultimo"); } };
})();
