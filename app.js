/* Urban Nex (celular) — telas. */
(function () {
  "use strict";
  const S = NUStore, U = NJUtil, G = UN;
  const $app = document.getElementById("app");
  const ui = { tab: "city", auth: "login", err: "", menu: false, report: null, dist: null, loanAmt: 10000, loanN: 12 };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "J$ " + (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cls = n => (n < 0 ? "neg" : "");
  function toast(msg, bad) {
    const t = document.getElementById("toast"); t.textContent = msg; t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = "toast"; }, 2600);
  }
  const user = () => { const k = S.db.session; return k ? S.db.users[k] || null : null; };
  const game = () => G.migrate(user().game);
  const num = id => { const el = document.getElementById(id); return el ? parseFloat(String(el.value).replace(",", ".")) : NaN; };

  // ------------------------------------------------------------------ contas
  async function register(name, pass) {
    name = name.trim().replace(/\s+/g, " "); const key = name.toLowerCase();
    if (name.length < 3) throw new G.GameError("O nome precisa ter pelo menos 3 letras.");
    if (pass.length < 4) throw new G.GameError("A senha precisa ter pelo menos 4 caracteres.");
    if (S.db.users[key]) throw new G.GameError("Esse nome já está em uso neste aparelho.");
    S.db.users[key] = { name, pass: await U.hashPassword(pass), created: new Date().toISOString(), game: G.newGame() };
    S.db.users[key].game.history.push(G.netWorth(S.db.users[key].game));
    S.db.session = key; S.save();
  }
  async function login(name, pass) {
    const key = name.trim().replace(/\s+/g, " ").toLowerCase(), u = S.db.users[key];
    if (!u || !(await U.checkPassword(u.pass, pass))) throw new G.GameError("Nome ou senha incorretos.");
    S.db.session = key; S.save();
  }

  // ------------------------------------------------------------------ telas
  function viewAuth() {
    const reg = ui.auth === "register";
    return `<div class="wrap auth">
      <div class="logo-card"><h1>🏙️ Urban Nex</h1><div class="sub">O TOPO DO MUNDO</div><p>Simulador econômico &amp; gestão de impérios</p></div>
      <div class="seg"><button data-act="auth" data-m="login" class="${reg ? "" : "on"}">🔐 Entrar</button><button data-act="auth" data-m="register" class="${reg ? "on" : ""}">📝 Criar conta</button></div>
      <label class="f">Nome de usuário</label><input id="au_name" autocomplete="username" autocapitalize="none">
      <label class="f">Senha</label><input id="au_pass" type="password" autocomplete="${reg ? "new-password" : "current-password"}">
      <div class="err" id="au_err">${esc(ui.err)}</div>
      <button class="btn green" data-act="${reg ? "do_register" : "do_login"}">${reg ? "✨ Criar conta e começar" : "🚀 Entrar no jogo"}</button>
      <p class="muted" style="font-size:13px;margin-top:16px">As contas ficam guardadas só neste aparelho. Use o backup do menu para não perder seu progresso.</p>
      <label class="btn ghost" style="display:block;text-align:center;margin-top:8px">📂 Restaurar de um arquivo de backup<input type="file" id="bk_file_auth" accept=".json,application/json" hidden></label>
    </div>`;
  }

  const pct = n => (n >= 0 ? "+" : "") + n.toFixed(1).replace(".", ",") + "%";
  const bar = (v, max, c) => `<div class="bar"><i class="${c || ""}" style="width:${Math.max(0, Math.min(100, max ? v / max * 100 : 0)).toFixed(0)}%"></i></div>`;
  const dname = i => G.DISTRICTS[i].short;

  function alertsHtml(p) {
    const order = { bad: 0, warn: 1, info: 2 }, ico = { bad: "🔴", warn: "🟡", info: "🔵" };
    const al = G.alerts(p).sort((a, b) => order[a.sev] - order[b.sev]);
    if (!al.length) return "";
    const show = al.slice(0, 4).map(a => `<button class="alert ${a.sev}" data-act="tab" data-k="${a.tab}">${ico[a.sev]} ${esc(a.text)}</button>`).join("");
    return `<div class="alerts"><div class="sec" style="margin:0 0 6px">🔔 Avisos (${al.length})</div>${show}${al.length > 4 ? `<div class="muted" style="font-size:12px;margin-top:4px">+ ${al.length - 4} avisos nas outras abas</div>` : ""}</div>`;
  }

  function hud(p) {
    const d = G.district(p), g = G.nextGoal(p), nw = G.netWorth(p);
    return `<div class="top"><div><h2>🏙️ Urban Nex</h2><small>Mês <b>${p.month}</b> · ${esc(user().name)}</small></div><button class="chip" data-act="menu">⚙️ Menu</button></div>
      <div class="banner">Bairro: <b class="p">${esc(d.name)}</b><br><small class="muted">Mês fiscal <b class="c">${p.month}</b></small></div>
      <div class="hud">
        <div class="metric"><div class="l">💵 Caixa disponível</div><div class="v ${cls(p.cash)}">${money(p.cash)}</div></div>
        <div class="metric"><div class="l">📊 Patrimônio líquido</div><div class="v ${cls(nw)}">${money(nw)}</div></div>
        <div class="metric"><div class="l">🏦 Dívida total</div><div class="v">${money(p.loan)}</div></div>
        <div class="metric"><div class="l">🎯 Meta próxima fase</div><div class="v">${money(g.remaining)}</div><div class="d">Alvo: ${money(g.target)}</div></div>
      </div>${alertsHtml(p)}`;
  }

  // ------------------------------------------------------------------ cidade + inventário
  function viewCity(p) {
    const lvl = G.level(p), nw = G.netWorth(p);
    const terrOf = i => p.terrains.filter(t => G.PLOT[t.id].level === i).length;
    const map = G.DISTRICTS.map(d => {
      const open = d.i <= lvl, here = p.businesses.filter(b => (b.dist || 0) === d.i).length;
      return `<div class="dist ${open ? "open" : "locked"} ${d.i === lvl ? "cur" : ""}"><div class="di">${d.icon}</div><b>${esc(d.short)}</b>
        <div class="muted" style="font-size:11px">Demanda ×${d.demand.toFixed(1).replace(".", ",")} · Custos ×${d.overhead.toFixed(1).replace(".", ",")}</div>
        ${open ? `<div style="font-size:12px;margin-top:6px">🏪 ${here} empresa(s)<br>🧱 ${terrOf(d.i)} terreno(s)</div>${d.i === lvl ? '<div class="here">📍 bairro mais alto</div>' : ""}`
          : `<div style="font-size:12px;margin-top:6px">🔒 Abre com ${money(d.need)}</div>${bar(nw, d.need)}<div class="muted" style="font-size:11px">${Math.min(100, nw / d.need * 100).toFixed(0)}% do caminho</div>`}</div>`;
    }).join("");
    const bizV = G.investedBusinesses(p), propV = p.properties.reduce((s, x) => s + x.value, 0), terV = p.terrains.reduce((s, x) => s + x.value, 0), stV = G.stocksValue(p);
    const stCost = Object.keys(p.shares).reduce((s, t) => s + G.stockPnl(p, t).cost, 0);
    const biz = p.businesses.length ? p.businesses.map(b => { const d = G.BIZ[b.type];
      return `<div class="inv"><div class="row"><b>${d.icon} ${esc(d.name)}</b><small class="muted">${esc(dname(b.dist || 0))}</small></div>
        <div class="row" style="font-size:12px"><span class="muted">Estoque ${b.stock}/${d.cap} un</span><span class="${cls(b.net)}">Último mês ${money(b.net)}</span></div>${bar(b.stock, d.cap, b.stock < d.cap * 0.25 ? "red" : "")}</div>`; }).join("") : `<div class="muted" style="font-size:13px">Nenhuma empresa ainda.</div>`;
    const props = p.properties.map(x => `<div class="inv row"><b>${G.PROP[x.key].icon} ${esc(G.PROP[x.key].name)}</b><span style="font-size:13px">${money(x.value)} · <span class="pos">+${money(x.rent)}/mês</span></span></div>`).join("");
    const ters = p.terrains.map(t => `<div class="inv row"><b>🧱 ${esc(G.PLOT[t.id].name)}</b><span style="font-size:13px">${money(t.value)} <small class="${t.value < t.price ? "neg" : "pos"}">${pct((t.value / t.price - 1) * 100)}</small></span></div>`).join("");
    const sts = Object.keys(p.shares).map(t => { const x = G.stockPnl(p, t); return `<div class="inv row"><b>📈 ${t} · ${x.q} ação(ões)</b><span style="font-size:13px">${money(x.value)} <small class="${x.pnl < 0 ? "neg" : "pos"}">${pct(x.pct)}</small></span></div>`; }).join("");
    return `<div class="sec" style="margin-top:6px">🗺️ Mapa da cidade</div><div class="map">${map}</div>
      <div class="sec">🎒 Inventário</div>
      <div class="kv"><div><span>Empresas (${p.businesses.length})</span><b>${money(bizV)}</b></div><div><span>Imóveis (${p.properties.length})</span><b>${money(propV)}</b></div>
        <div><span>Terrenos (${p.terrains.length})</span><b>${money(terV)}</b></div><div><span>Ações (fora do patrimônio)</span><b>${money(stV)}</b>${stCost ? `<small class="${stV - stCost < 0 ? "neg" : "pos"}">${pct((stV / stCost - 1) * 100)}</small>` : ""}</div></div>
      <div class="sec">Minhas empresas</div><div class="list">${biz}</div>
      ${props ? `<div class="sec">Meus imóveis</div><div class="list">${props}</div>` : ""}${ters ? `<div class="sec">Meus terrenos</div><div class="list">${ters}</div>` : ""}${sts ? `<div class="sec">Minhas ações</div><div class="list">${sts}</div>` : ""}
      ${p.bankruptcies ? `<p class="muted" style="font-size:12px;margin-top:14px">💀 Falências: ${p.bankruptcies}</p>` : ""}`;
  }

  // ------------------------------------------------------------------ empresas
  function viewBiz(p) {
    const lvl = G.level(p), dist = Math.min(ui.dist == null ? lvl : ui.dist, lvl), dd = G.DISTRICTS[dist];
    const offers = p.offers.length ? `<div class="sec" style="margin-top:6px">📩 Propostas de compra</div><div class="list">${p.offers.map(o => {
      const biz = p.businesses.find(b => b.id === o.bizId), base = biz ? G.paidOf(biz) : 0, pr = base ? (o.price / base - 1) * 100 : 0;
      return `<div class="card"><div class="row"><b>📩 ${esc(o.name)}</b><span class="pos">${money(o.price)}</span></div>
        <div class="muted" style="font-size:13px;margin:4px 0 10px">${esc(o.buyer)}${base ? ` · ${pct(pr)} sobre o que você pagou (${money(base)})` : ""}${o.exp ? ` · vale até o mês ${o.exp}` : ""}</div>
        <div class="inline"><button class="btn sm green" data-act="accept_offer" data-id="${o.id}">Aceitar</button><button class="btn sm ghost" data-act="decline_offer" data-id="${o.id}">Recusar</button></div></div>`; }).join("")}</div>` : "";
    const seg = G.DISTRICTS.map(d => `<button data-act="dist" data-d="${d.i}" class="${d.i === dist ? "on" : ""}" ${d.i > lvl ? "disabled" : ""}>${d.i > lvl ? "🔒" : d.icon}<br><small>${esc(d.short)}</small></button>`).join("");
    const store = G.BIZ_STORE.map(k => { const d = G.BIZ[k], need = G.BIZ_LEVEL[k];
      if (need > lvl) return `<div class="card center lockedc"><div class="ico">🔒</div><h4>${esc(d.name)}</h4><div class="muted" style="font-size:12px">Abre no<br><b>${esc(dname(need))}</b></div></div>`;
      return `<div class="card center"><div class="ico">${d.icon}</div><h4>${esc(d.name)}</h4><div class="muted" style="font-size:12px">Setor: ${esc(d.label)}</div><div class="price">${money(G.bizCost(k, dist))}</div><button class="btn sm" style="width:100%" data-act="buy_biz" data-k="${k}">Comprar</button></div>`; }).join("");
    const mine = p.businesses.length ? p.businesses.map((b, i) => {
      const d = G.BIZ[b.type], room = d.cap - b.stock;
      return `<div class="card"><div class="row"><b>${d.icon} ${esc(d.name)}</b><span class="${cls(b.net)}">Último mês: ${money(b.net)}</span></div>
        <div class="muted" style="font-size:12px">📍 ${esc(dname(b.dist || 0))} · pago ${money(G.paidOf(b))}</div>
        <div class="kv"><div><span>Faturamento</span><b>${money(b.gross)}</b></div><div><span>Custos</span><b>${money(b.overhead)}</b></div><div><span>Impostos</span><b>${money(b.tax)}</b></div><div><span>Lucro líquido</span><b class="${cls(b.net)}">${money(b.net)}</b></div></div>
        <div class="muted" style="font-size:13px">Caixa da filial: <b>${money(b.capital)}</b> · Estoque: <b>${b.stock}/${d.cap} un</b>${b.stock === 0 ? ' <b class="neg">— sem estoque!</b>' : ""}</div>${bar(b.stock, d.cap, b.stock < d.cap * 0.25 ? "red" : "")}
        <div class="sec" style="margin:12px 0 6px">📦 Repor estoque <small style="text-transform:none;letter-spacing:0">(J$ ${G.restockUnitCost(b).toFixed(2)} por unidade)</small></div>
        <div class="inline"><input id="rst_${i}" type="number" inputmode="numeric" min="1" max="${room}" value="${room}"><button class="btn sm green" data-act="restock" data-i="${i}" ${room <= 0 ? "disabled" : ""}>Repor</button></div>
        <div class="sec" style="margin:12px 0 6px">💼 Injetar capital</div>
        <div class="inline"><input id="inj_${i}" type="number" inputmode="decimal" min="100" step="500" value="500"><button class="btn sm" data-act="inject" data-i="${i}">Aportar</button></div>
        <div class="inline" style="margin-top:12px"><button class="btn sm ghost" data-act="ask_offer" data-i="${i}">📩 Pedir proposta</button><button class="btn red sm" data-act="sell_biz" data-i="${i}">Vender (${money(G.sellValue(b))})</button></div></div>`;
    }).join("") : `<div class="empty">Ainda não possuis empresas ativas.</div>`;
    return `${offers}<div class="sec" style="margin-top:6px">Onde abrir a empresa?</div><div class="seg4">${seg}</div>
      <div class="muted" style="font-size:12px;margin:6px 2px 10px">${esc(dd.name)}: preços ×${dd.price.toFixed(1).replace(".", ",")} · vendas ×${dd.demand.toFixed(1).replace(".", ",")} · custo fixo ×${dd.overhead.toFixed(1).replace(".", ",")}. Novos bairros abrem com o patrimônio.</div>
      <div class="sec" style="margin-top:6px">Catálogo de empreendimentos</div><div class="grid">${store}</div>
      <div class="sec">📊 DRE &amp; desempenho das filiais</div><div class="list">${mine}</div>`;
  }

  // ------------------------------------------------------------------ imóveis e terrenos
  function viewRE(p) {
    const lvl = G.level(p), avail = G.availableProperties(p), locked = G.lockedProperties(p);
    const market = avail.map(x => `<div class="card"><h4 style="margin-top:0">${x.icon} ${esc(x.name)}</h4><div class="muted">Preço: <b style="color:var(--cyan)">${money(x.price)}</b></div><div class="muted">Renda passiva: <b class="pos">+ ${money(x.rent)}/mês</b></div><button class="btn sm" style="width:100%;margin-top:10px" data-act="buy_re" data-k="${x.key}">Investir</button></div>`).join("")
      + locked.map(x => `<div class="card lockedc"><h4 style="margin-top:0">🔒 ${esc(x.name)}</h4><div class="muted" style="font-size:12px">Abre no <b>${esc(dname(G.PROP_LEVEL[x.key]))}</b></div></div>`).join("");
    const mine = p.properties.length ? p.properties.map((x, i) => `<div class="card"><div class="row"><b>${G.PROP[x.key].icon} ${esc(G.PROP[x.key].name)}</b></div>
      <div class="kv"><div><span>Valor atual</span><b>${money(x.value)}</b></div><div><span>Aluguel mensal</span><b class="pos">+ ${money(x.rent)}</b></div></div>
      <button class="btn sm" style="width:100%" data-act="renovate" data-i="${i}">🛠️ Reformar (${money(G.renovateCost(x))})</button></div>`).join("") : `<div class="empty">Ainda não possuis imóveis adquiridos.</div>`;
    const plots = G.availableTerrains(p).map(t => `<div class="card"><div class="row"><b>🧱 ${esc(t.name)}</b><b style="color:var(--cyan)">${money(t.price)}</b></div><button class="btn sm" style="width:100%;margin-top:8px" data-act="buy_ter" data-id="${t.id}">Comprar terreno</button></div>`).join("") || `<div class="empty">Você comprou todos os terrenos disponíveis.</div>`;
    const lockedD = G.DISTRICTS.filter(d => d.i > lvl).map(d => `<div class="muted" style="font-size:12px">🔒 Terrenos do ${esc(d.short)} abrem com ${money(d.need)} de patrimônio.</div>`).join("");
    const myT = p.terrains.map((t, i) => `<div class="card"><div class="row"><b>🧱 ${esc(G.PLOT[t.id].name)}</b><span class="${t.value < t.price ? "neg" : "pos"}">${pct((t.value / t.price - 1) * 100)}</span></div>
      <div class="kv"><div><span>Pago</span><b>${money(t.price)}</b></div><div><span>Valor atual</span><b>${money(t.value)}</b></div></div>
      <button class="btn sm red" style="width:100%" data-act="sell_ter" data-i="${i}">Vender (${money(G.terrainSellValue(t))})</button></div>`).join("");
    return `<div class="sec" style="margin-top:6px">Mercado imobiliário</div><div class="grid two">${market}</div><div class="sec">🏢 Meus imóveis &amp; valuation</div><div class="list">${mine}</div>
      <div class="sec">🧱 Terrenos à venda</div><p class="muted" style="font-size:12px;margin:0 2px 8px">Terrenos não rendem aluguel: o valor oscila entre -3% e +7% ao mês. Vender cobra 5% de taxa.</p><div class="grid two">${plots}</div><div class="list" style="margin-top:8px">${lockedD}</div>
      ${myT ? `<div class="sec">Meus terrenos</div><div class="list">${myT}</div>` : ""}`;
  }

  // ------------------------------------------------------------------ banco
  function simHtml(p, amount, months) {
    const s = G.simulateLoan(amount, months, p.rate);
    if (!s || amount < 1000) return `<div class="muted">Digite um valor a partir de J$ 1.000,00.</div>`;
    const fits = p.cash + amount - s.pmt >= 0;
    return `<div class="kv"><div><span>Parcela mensal</span><b>${money(s.pmt)}</b></div><div><span>Total a pagar</span><b>${money(s.total)}</b></div>
      <div><span>Juros no total</span><b class="neg">${money(s.interest)}</b></div><div><span>Taxa</span><b>${(s.rate * 100).toFixed(1).replace(".", ",")}% ao mês</b></div></div>
      <div class="muted" style="font-size:12px">Você recebe ${money(amount)} agora e paga ${s.months}× de ${money(s.pmt)}. Se atrasar 3 parcelas, o banco toma seus bens.</div>`;
  }
  function viewBank(p) {
    const amt = ui.loanAmt || 10000, mon = ui.loanN || 12;
    const loans = p.loans.length ? p.loans.map((l, i) => `<div class="card ${l.late ? "latec" : ""}"><div class="row"><b>📄 Contrato ${i + 1}</b><span class="muted" style="font-size:12px">${(l.rate * 100).toFixed(1).replace(".", ",")}% a.m.</span></div>
      <div class="muted" style="font-size:12px">Pegou ${money(l.principal)} em ${l.n} parcelas (mês ${l.since})</div>
      <div class="kv"><div><span>Saldo devedor</span><b>${money(l.balance)}</b></div><div><span>Parcela</span><b>${money(l.pmt)}</b></div><div><span>Parcelas restantes</span><b>${l.left}</b></div><div><span>Atrasos</span><b class="${l.late ? "neg" : ""}">${l.late}/${G.MAX_LATE}</b></div></div>
      <div class="inline"><input id="pay_${l.id}" type="number" inputmode="decimal" min="100" step="100" value="${Math.min(l.balance, Math.max(100, Math.round(l.pmt)))}"><button class="btn sm green" data-act="pay" data-id="${l.id}">Pagar</button><button class="btn sm ghost" data-act="quit" data-id="${l.id}">Quitar</button></div></div>`).join("")
      : `<div class="empty">Você não tem dívidas. 🎉</div>`;
    return `<div class="card" style="margin-top:6px">Taxa de juros atual: <b>${(p.rate * 100).toFixed(1).replace(".", ",")}% ao mês</b><br>Saldo devedor total: <b>${money(p.loan)}</b>${p.loans.length ? `<br>Parcelas do próximo mês: <b>${money(G.nextInstallments(p))}</b>` : ""}</div>
      <div class="sec">💰 Simular e pedir empréstimo</div>
      <label class="f" style="margin-top:0">Quanto você quer?</label><input id="loan_in" type="number" inputmode="decimal" min="1000" step="1000" value="${amt}">
      <label class="f">Em quantas parcelas?</label><select id="loan_n">${G.MONTHS_OPTS.map(n => `<option value="${n}" ${n === mon ? "selected" : ""}>${n} meses</option>`).join("")}</select>
      <div class="card" id="loan_sim" style="margin-top:10px">${simHtml(p, amt, mon)}</div>
      <button class="btn" style="margin-top:10px" data-act="loan">✅ Contratar este empréstimo</button>
      <div class="sec">📄 Meus empréstimos</div><div class="list">${loans}</div>
      <div class="sec">🤝 Renegociar taxa com o banco</div><button class="btn ghost" data-act="negotiate">Solicitar redução de taxa</button>`;
  }

  // ------------------------------------------------------------------ gráficos
  const short = n => { const a = Math.abs(n), sg = n < 0 ? "-" : ""; return a >= 1e6 ? sg + (a / 1e6).toFixed(1).replace(".", ",") + "M" : a >= 1e3 ? sg + Math.round(a / 1e3) + "k" : sg + Math.round(a); };
  function spark(vals, color) {
    if (vals.length < 2) return "";
    const W = 110, H = 36, mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - 3 - (v - mn) / rg * (H - 6)).toFixed(1)}`).join(" ");
    const up = vals[vals.length - 1] >= vals[0];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color || (up ? "#34d399" : "#f87171")}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  function chart(h) {
    h = h.slice(-36);
    if (h.length < 2) return `<div class="empty">Avance alguns meses para ver a evolução do seu patrimônio.</div>`;
    const W = 320, H = 150, L = 6, Rr = 6, T = 14, B = 10;
    let mn = Math.min(...h), mx = Math.max(...h); if (mx - mn < 1) { mx += 1; mn -= 1; }
    const padv = (mx - mn) * 0.08; mn -= padv; mx += padv;
    const X = i => L + i / (h.length - 1) * (W - L - Rr), Y = v => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
    const line = h.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const area = `${X(0).toFixed(1)},${H - B} ${line} ${X(h.length - 1).toFixed(1)},${H - B}`;
    const th = G.DISTRICTS.slice(1).filter(d => d.need > mn && d.need < mx).map(d => `<line x1="${L}" x2="${W - Rr}" y1="${Y(d.need).toFixed(1)}" y2="${Y(d.need).toFixed(1)}" stroke="#a855f7" stroke-dasharray="4 4" stroke-width="1" opacity=".7"/><text x="${W - Rr}" y="${(Y(d.need) - 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#c4b5fd">${esc(d.name.split(":")[0])}</text>`).join("");
    const last = h[h.length - 1];
    return `<div class="card"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do patrimônio líquido">
      <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8" stop-opacity=".4"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></linearGradient></defs>
      ${th}<polygon points="${area}" fill="url(#ga)"/><polyline points="${line}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(h.length - 1).toFixed(1)}" cy="${Y(last).toFixed(1)}" r="3.5" fill="#38bdf8"/>
      <text x="${L}" y="9" font-size="9" fill="#94a3b8">máx ${short(Math.max(...h))}</text><text x="${L}" y="${H - 1}" font-size="9" fill="#94a3b8">mín ${short(Math.min(...h))}</text></svg>
      <div class="row muted" style="font-size:12px"><span>Últimos ${h.length} registros</span><b class="${cls(last)}" style="color:var(--cyan)">${money(last)}</b></div></div>`;
  }

  // ------------------------------------------------------------------ bolsa
  function viewStock(p) {
    const held = G.stocksValue(p), cost = Object.keys(p.shares).reduce((s, t) => s + G.stockPnl(p, t).cost, 0), pnl = held - cost;
    const cards = G.STOCKS.map(s => {
      const m = p.market[s.ticker], h = m.history, prev = h.length > 1 ? h[h.length - 2] : m.price, ch = prev ? (m.price / prev - 1) * 100 : 0, x = G.stockPnl(p, s.ticker);
      return `<div class="card"><div class="row"><b>${s.ticker}</b><span class="muted" style="font-size:12px">${esc(s.name)}</span></div>
        <div class="row" style="margin:6px 0"><div><div class="big">${money(m.price)}</div><small class="${ch < 0 ? "neg" : "pos"}">${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(1).replace(".", ",")}% no mês</small></div>${spark(h)}</div>
        ${x.q ? `<div class="kv"><div><span>Você tem</span><b>${x.q} ação(ões)</b></div><div><span>Preço médio pago</span><b>${money(x.avg)}</b></div><div><span>Valor hoje</span><b>${money(x.value)}</b></div><div><span>Lucro / prejuízo</span><b class="${x.pnl < 0 ? "neg" : "pos"}">${x.pnl >= 0 ? "+" : "-"} ${money(Math.abs(x.pnl))}<br><small>${pct(x.pct)}</small></b></div></div>` : `<div class="muted" style="font-size:12px">Você ainda não tem ações ${s.ticker}.</div>`}
        <div class="muted" style="font-size:12px;margin-top:4px">Dividendo ${(s.yield * 100).toFixed(1).replace(".", ",")}% ao mês</div>
        <div class="inline" style="margin-top:8px"><input id="stk_${s.ticker}" type="number" inputmode="numeric" min="1" step="1" value="1"><button class="btn sm" data-act="buy_sh" data-t="${s.ticker}">Comprar</button><button class="btn sm red" data-act="sell_sh" data-t="${s.ticker}" ${x.q ? "" : "disabled"}>Vender</button></div>
        ${x.q ? `<button class="btn sm ghost" style="width:100%;margin-top:8px" data-act="sell_all" data-t="${s.ticker}">Vender tudo (${money(x.value)})</button>` : ""}</div>`;
    }).join("");
    return `<div class="card" style="margin-top:6px"><div class="row"><span>📈 Valor da sua carteira</span><b style="color:var(--cyan)">${money(held)}</b></div>
      ${cost ? `<div class="row" style="margin-top:4px"><span class="muted">Lucro / prejuízo total</span><b class="${pnl < 0 ? "neg" : "pos"}">${pnl >= 0 ? "+" : "-"} ${money(Math.abs(pnl))} (${pct(cost ? (held / cost - 1) * 100 : 0)})</b></div>` : ""}
      <div class="muted" style="font-size:12px;margin-top:6px">Os preços mudam a cada mês, e os dividendos caem no caixa. Como no jogo original, as ações não entram no Patrimônio Líquido. Quando uma ação ficar 20% acima do seu preço médio, você recebe um aviso.</div></div>
      <div class="sec">Ações da Urban Nex</div><div class="list">${cards}</div>`;
  }

  // ------------------------------------------------------------------ tempo
  function viewMonth(p) {
    const reps = p.reports.length ? p.reports.slice(0, 12).map((r, i) => { const d = r.after - r.before;
      return `<button class="hi" data-act="report_open" data-i="${i}"><span>📅 Mês ${r.month} · ${esc(r.event.name)}</span><b class="${d < 0 ? "neg" : "pos"}">${d >= 0 ? "+" : "-"} ${money(Math.abs(d))}</b></button>`; }).join("") : `<div class="empty">Os relatórios dos meses ficam guardados aqui.</div>`;
    return `<button class="btn go" data-act="advance">⚡ Avançar para o mês ${p.month + 1}</button>
      <p class="muted" style="font-size:13px;margin:8px 2px">Ao avançar, as empresas vendem, pagam custos e impostos, os imóveis rendem aluguel, as ações pagam dividendos, o banco cobra a parcela e um evento pode acontecer.</p>
      <div class="sec">📈 Evolução do patrimônio</div>${chart(p.history)}
      <div class="sec">📚 Relatórios dos meses</div><div class="list">${reps}</div>
      <div class="sec">📜 Últimos acontecimentos</div><div class="card log">${p.log.slice(0, 12).map(l => `<div>Mês ${l.month}: ${esc(l.text)}</div>`).join("") || "Nada ainda."}</div>`;
  }
  function viewReport(r) {
    const ev = r.event, kind = ev.type === "BOOM" ? "good" : ev.type === "NORMAL" ? "calm" : "bad";
    const biz = r.businesses.length ? r.businesses.map(b => `<div class="rep"><div class="row"><b>${esc(b.name)}</b><b class="${cls(b.net)}">${money(b.net)}</b></div><div class="muted" style="font-size:12px">Vendeu ${b.sold} un. · faturou ${money(b.gross)} · custos ${money(b.overhead)} · impostos ${money(b.tax)}</div></div>`).join("") : `<div class="muted">Você não tinha empresas ativas.</div>`;
    const d = r.after - r.before, inst = r.installments || 0;
    const flags = [
      r.bankrupt ? `<div class="ev bad"><b>💀 FALÊNCIA!</b><br><small>O banco tomou tudo (${esc((r.seized || []).join(", "))}). Você recomeçou com ${money(G.RESTART_CASH)}.</small></div>` : "",
      !r.bankrupt && r.seized && r.seized.length ? `<div class="ev bad"><b>🏦 O banco tomou bens!</b><br><small>${esc(r.seized.join(", "))} foram leiloados (70% do valor) para cobrir a dívida.</small></div>` : "",
      r.late && r.late.length ? `<div class="ev bad"><b>⚠️ Parcela atrasada</b><br><small>${esc(r.late.join(" · "))}</small></div>` : "",
      r.unlocked ? `<div class="ev good"><b>🎉 Novo bairro desbloqueado!</b><br><small>${esc(r.unlocked)}</small></div>` : "",
      r.newOffers ? `<div class="ev calm"><b>📩 ${r.newOffers} nova(s) proposta(s) de compra!</b><br><small>Veja na aba Empresas.</small></div>` : "",
    ].join("");
    return `<div class="modal" data-act="report_close"><div class="box">
      <h3>📅 Relatório do mês ${r.month}</h3>
      <div class="ev ${kind}"><b>${esc(ev.name)}</b><br><small>${esc(ev.description)}</small></div>${flags}
      <div class="sec" style="margin-top:12px">Empresas</div>${biz}
      <div class="sec">Outras movimentações</div>
      <div class="kv"><div><span>Aluguéis</span><b class="pos">+ ${money(r.rent)}</b></div><div><span>Dividendos</span><b class="pos">+ ${money(r.dividends)}</b></div><div><span>Parcelas pagas</span><b>${inst ? "- " : ""}${money(inst)}</b></div><div><span>Juros do mês</span><b>${money(r.interest || 0)}</b></div>
        <div><span>Multas</span><b class="${(r.fine || 0) + (r.fines || 0) ? "neg" : ""}">${(r.fine || 0) + (r.fines || 0) ? "- " : ""}${money((r.fine || 0) + (r.fines || 0))}</b></div></div>
      <div class="card row"><span>Variação do patrimônio</span><b class="${d < 0 ? "neg" : "pos"}">${d >= 0 ? "+ " : "- "}${money(Math.abs(d))}</b></div>
      <button class="btn" style="margin-top:12px" data-act="report_close">Continuar</button></div></div>`;
  }

  function viewMenu(p) {
    const logs = p.log.slice(0, 12).map(l => `<div>Mês ${l.month}: ${esc(l.text)}</div>`).join("") || "<div>Nada ainda.</div>";
    return `<div class="modal" data-act="menu_close"><div class="box">
      <h3>⚙️ Perfil do CEO</h3><p>Empresário: <b>${esc(user().name)}</b></p>
      <div class="sec" style="margin-top:6px">💾 Cópia de segurança</div>
      <button class="btn" data-act="backup">📤 Salvar cópia em arquivo</button>
      <label class="btn ghost" style="display:block;text-align:center;margin-top:8px">📂 Restaurar de um arquivo<input type="file" id="bk_file" accept=".json,application/json" hidden></label>
      <p class="muted" style="font-size:13px">Guarde o arquivo no Drive, e-mail ou WhatsApp. Se trocar de celular ou apagar os dados do navegador, é ele que traz tudo de volta.</p>
      <div class="sec">📜 Últimos acontecimentos</div><div class="log">${logs}</div>
      <div class="sec">Conta</div><button class="btn ghost" data-act="logout">🚪 Encerrar sessão</button>
      <button class="btn ghost" style="margin-top:8px" data-act="menu_close">Fechar</button></div></div>`;
  }

  function render() {
    const u = user();
    if (!u) { $app.innerHTML = viewAuth(); return; }
    const p = G.migrate(u.game);
    const tabs = [["city", "🏙️", "Cidade"], ["biz", "🏪", "Empresas"], ["re", "🏢", "Imóveis"], ["stock", "📈", "Bolsa"], ["bank", "💳", "Banco"], ["month", "⚡", "Tempo"]];
    const cnt = {}; for (const a of G.alerts(p)) cnt[a.tab] = (cnt[a.tab] || 0) + 1;
    const body = { city: viewCity, biz: viewBiz, re: viewRE, bank: viewBank, stock: viewStock, month: viewMonth }[ui.tab](p);
    $app.innerHTML = `<div class="wrap">${hud(p)}${body}</div>
      <nav class="tabs">${tabs.map(([k, i, n]) => `<button data-act="tab" data-k="${k}" class="${ui.tab === k ? "on" : ""}">${i}<span>${n}</span>${cnt[k] ? `<em class="nb">${cnt[k]}</em>` : ""}</button>`).join("")}</nav>${ui.menu ? viewMenu(p) : ""}${ui.report ? viewReport(ui.report) : ""}`;
  }

  // ------------------------------------------------------------------ backup
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function restoreFile(file) {
    if (!file) return;
    try {
      const n = S.importJSON(await file.text(), false);
      await S.flush(); toast(`✅ Backup restaurado (${n} conta${n === 1 ? "" : "s"}). Entre na sua conta.`);
      S.db.session = null; ui.menu = false; render();
    } catch (e) { toast(e.message, true); }
  }

  // ------------------------------------------------------------------ ações
  const actions = {
    auth: el => { ui.auth = el.dataset.m; ui.err = ""; render(); },
    do_register: async () => { try { await register(document.getElementById("au_name").value, document.getElementById("au_pass").value); ui.err = ""; ui.tab = "city"; render(); } catch (e) { ui.err = e.message; document.getElementById("au_err").textContent = e.message; } },
    do_login: async () => { try { await login(document.getElementById("au_name").value, document.getElementById("au_pass").value); ui.err = ""; ui.tab = "city"; render(); } catch (e) { ui.err = e.message; document.getElementById("au_err").textContent = e.message; } },
    tab: el => { ui.tab = el.dataset.k; render(); window.scrollTo(0, 0); },
    menu: () => { ui.menu = true; render(); },
    menu_close: () => { ui.menu = false; render(); },
    logout: () => { S.db.session = null; ui.menu = false; S.save(); render(); },
    backup: () => { const d = new Date(), z = n => String(n).padStart(2, "0"); download(`urban_nex_backup_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.json`, S.exportJSON()); toast("Cópia salva. Guarde o arquivo no Drive ou WhatsApp."); },
    buy_biz: el => { const g = game(), d = G.BIZ[el.dataset.k], dist = Math.min(ui.dist == null ? G.level(g) : ui.dist, G.level(g)); G.buyBusiness(g, el.dataset.k, dist); toast(`${d.name} aberto no ${G.DISTRICTS[dist].short}!`); },
    dist: el => { ui.dist = +el.dataset.d; },
    sell_biz: el => { const b = game().businesses[+el.dataset.i]; if (!b) return; if (!confirm(`Vender ${G.BIZ[b.type].name} por ${money(G.sellValue(b))}?`)) return; const v = G.sellBusiness(game(), +el.dataset.i); toast(`Empresa vendida por ${money(v)}.`); },
    restock: el => { const r = G.restock(game(), +el.dataset.i, num("rst_" + el.dataset.i)); toast(`+${r.units} unidades (${money(r.cost)}).`); },
    inject: el => { const v = num("inj_" + el.dataset.i); G.injectCapital(game(), +el.dataset.i, v); toast(`Aporte de ${money(v)} realizado!`); },
    buy_re: el => { G.buyProperty(game(), el.dataset.k); toast(`${G.PROP[el.dataset.k].name} comprado!`); },
    renovate: el => { const x = game().properties[+el.dataset.i]; G.renovate(game(), +el.dataset.i); toast(`${G.PROP[x.key].name} reformado!`); },
    loan: () => { const v = num("loan_in"), n = +document.getElementById("loan_n").value, s = G.simulateLoan(v, n, game().rate); if (!(v >= 1000)) throw new G.GameError("O empréstimo mínimo é J$ 1.000,00."); if (!confirm(`Contratar ${money(v)} em ${n}× de ${money(s.pmt)}? Total a pagar: ${money(s.total)}.`)) return; G.takeLoan(game(), v, n); toast(`Crédito de ${money(v)} depositado! Parcela: ${money(s.pmt)}.`); },
    pay: el => { const v = G.payLoan(game(), num("pay_" + el.dataset.id), el.dataset.id); toast(`Dívida abatida em ${money(v)}!`); },
    quit: el => { const l = game().loans.find(x => x.id === el.dataset.id); if (!l) return; const v = G.payLoan(game(), l.balance, l.id); toast(`Contrato quitado: ${money(v)}.`); },
    buy_ter: el => { G.buyTerrain(game(), el.dataset.id); toast(`${G.PLOT[el.dataset.id].name} comprado!`); },
    sell_ter: el => { const v = G.sellTerrain(game(), +el.dataset.i); toast(`Terreno vendido por ${money(v)}.`); },
    sell_all: el => { const t = el.dataset.t, q = game().shares[t] || 0; if (!q) return; const r = G.sellShares(game(), t, q); toast(`Vendeu ${q} ${t}: ${r.profit >= 0 ? "lucro" : "prejuízo"} de ${money(Math.abs(r.profit))}.`, r.profit < 0); },
    report_open: el => { ui.report = game().reports[+el.dataset.i] || null; },
    buy_sh: el => { const q = Math.floor(num("stk_" + el.dataset.t)); G.buyShares(game(), el.dataset.t, q); toast(`Comprou ${q} ${el.dataset.t}.`); },
    sell_sh: el => { const q = Math.floor(num("stk_" + el.dataset.t)); const r = G.sellShares(game(), el.dataset.t, q); toast(`Vendeu ${q} ${el.dataset.t}: ${r.profit >= 0 ? "lucro" : "prejuízo"} de ${money(Math.abs(r.profit))}.`, r.profit < 0); },
    ask_offer: el => { const v = G.requestOffer(game(), +el.dataset.i); toast(`Proposta recebida: ${money(v)}.`); },
    accept_offer: el => { const o = game().offers.find(x => x.id === el.dataset.id); if (!o) return; if (!confirm(`Vender ${o.name} por ${money(o.price)}?`)) return; G.acceptOffer(game(), o.id); toast(`Empresa vendida por ${money(o.price)}.`); },
    decline_offer: el => { G.declineOffer(game(), el.dataset.id); toast("Proposta recusada."); },
    advance: () => { ui.report = G.advanceMonth(game()); },
    report_close: () => { ui.report = null; window.scrollTo(0, 0); },
    negotiate: () => { const [ok, msg] = G.negotiate(game()); toast(msg, !ok); },
  };
  $app.addEventListener("click", async e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    if (el.classList.contains("modal") && e.target !== el) return;
    const fn = actions[el.dataset.act]; if (!fn) return;
    try { await fn(el); if (S.db.session && !["menu", "menu_close", "auth", "tab", "backup"].includes(el.dataset.act)) { const up = G.syncLevel(game()); if (up) toast(`🎉 Novo bairro desbloqueado: ${up.short}!`); S.save(); render(); } }
    catch (err) { if (err instanceof G.GameError) toast(err.message, true); else { console.error(err); toast("Erro: " + err.message, true); } }
  });
  function updateSim(e) {
    if (e.target.id !== "loan_in" && e.target.id !== "loan_n") return;
    const u = user(); if (!u) return;
    ui.loanAmt = num("loan_in") || 0; ui.loanN = +document.getElementById("loan_n").value || 12;
    const box = document.getElementById("loan_sim"); if (box) box.innerHTML = simHtml(game(), ui.loanAmt, ui.loanN);
  }
  $app.addEventListener("input", updateSim);
  $app.addEventListener("change", updateSim);
  $app.addEventListener("change", e => { if (e.target.id === "bk_file" || e.target.id === "bk_file_auth") restoreFile(e.target.files[0]); });
  $app.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id && e.target.id.startsWith("au_")) { const b = $app.querySelector('[data-act="do_login"],[data-act="do_register"]'); if (b) b.click(); } });

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  S.open().then(() => { if (S.db.session && !S.db.users[S.db.session]) S.db.session = null; render(); window.__ready = true; });
})();
