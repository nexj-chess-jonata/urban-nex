/* Urban Nex (celular) — telas. */
(function () {
  "use strict";
  const S = NUStore, U = NJUtil, G = UN;
  const $app = document.getElementById("app");
  const ui = { tab: "biz", auth: "login", err: "", menu: false, report: null };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "J$ " + (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cls = n => (n < 0 ? "neg" : "");
  function toast(msg, bad) {
    const t = document.getElementById("toast"); t.textContent = msg; t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = "toast"; }, 2600);
  }
  const user = () => { const k = S.db.session; return k ? S.db.users[k] || null : null; };
  const game = () => user().game;
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

  function hud(p) {
    const d = G.district(p), g = G.nextGoal(p), nw = G.netWorth(p);
    return `<div class="top"><div><h2>🏙️ Urban Nex</h2><small>Mês <b>${p.month}</b> · ${esc(user().name)}</small></div><button class="chip" data-act="menu">⚙️ Menu</button></div>
      <div class="banner">Bairro: <b class="p">${esc(d.name)}</b><br><small class="muted">Mês fiscal <b class="c">${p.month}</b></small></div>
      <div class="hud">
        <div class="metric"><div class="l">💵 Caixa disponível</div><div class="v ${cls(p.cash)}">${money(p.cash)}</div></div>
        <div class="metric"><div class="l">📊 Patrimônio líquido</div><div class="v ${cls(nw)}">${money(nw)}</div></div>
        <div class="metric"><div class="l">🏦 Dívida total</div><div class="v">${money(p.loan)}</div></div>
        <div class="metric"><div class="l">🎯 Meta próxima fase</div><div class="v">${money(g.remaining)}</div><div class="d">Alvo: ${money(g.target)}</div></div>
      </div>`;
  }

  function viewBiz(p) {
    const store = G.BIZ_STORE.map(k => { const d = G.BIZ[k]; return `<div class="card center"><div class="ico">${d.icon}</div><h4>${esc(d.name)}</h4><div class="muted" style="font-size:12px">Setor: ${esc(d.label)}</div><div class="price">${money(d.cost)}</div><button class="btn sm" style="width:100%" data-act="buy_biz" data-k="${k}">Comprar</button></div>`; }).join("");
    const mine = p.businesses.length ? p.businesses.map((b, i) => {
      const d = G.BIZ[b.type], room = d.cap - b.stock;
      return `<div class="card"><div class="row"><b>${d.icon} ${esc(d.name)}</b><span class="${cls(b.net)}">Último mês: ${money(b.net)}</span></div>
        <div class="kv"><div><span>Faturamento</span><b>${money(b.gross)}</b></div><div><span>Custos</span><b>${money(b.overhead)}</b></div><div><span>Impostos</span><b>${money(b.tax)}</b></div><div><span>Lucro líquido</span><b class="${cls(b.net)}">${money(b.net)}</b></div></div>
        <div class="muted" style="font-size:13px">Caixa da filial: <b>${money(b.capital)}</b> · Estoque: <b>${b.stock}/${d.cap} un</b>${b.stock === 0 ? ' <b class="neg">— sem estoque!</b>' : ""}</div>
        <div class="sec" style="margin:12px 0 6px">📦 Repor estoque <small style="text-transform:none;letter-spacing:0">(J$ ${G.restockUnitCost(b).toFixed(2)} por unidade)</small></div>
        <div class="inline"><input id="rst_${i}" type="number" inputmode="numeric" min="1" max="${room}" value="${room}"><button class="btn sm green" data-act="restock" data-i="${i}" ${room <= 0 ? "disabled" : ""}>Repor</button></div>
        <div class="sec" style="margin:12px 0 6px">💼 Injetar capital</div>
        <div class="inline"><input id="inj_${i}" type="number" inputmode="decimal" min="100" step="500" value="500"><button class="btn sm" data-act="inject" data-i="${i}">Aportar</button></div>
        <button class="btn red sm" style="width:100%;margin-top:12px" data-act="sell_biz" data-i="${i}">🔴 Vender empresa (${money(d.cost * 0.9)})</button></div>`;
    }).join("") : `<div class="empty">Ainda não possuis empresas ativas.</div>`;
    return `<div class="sec" style="margin-top:6px">Catálogo de empreendimentos</div><div class="grid">${store}</div>
      <div class="sec">📊 DRE &amp; desempenho das filiais</div><div class="list">${mine}</div>`;
  }

  function viewRE(p) {
    const avail = G.availableProperties(p);
    const market = avail.length ? avail.map(x => `<div class="card"><h4 style="margin-top:0">${x.icon} ${esc(x.name)}</h4><div class="muted">Preço: <b style="color:var(--cyan)">${money(x.price)}</b></div><div class="muted">Renda passiva: <b class="pos">+ ${money(x.rent)}/mês</b></div><button class="btn sm" style="width:100%;margin-top:10px" data-act="buy_re" data-k="${x.key}">Investir</button></div>`).join("") : `<div class="empty">Você comprou todos os imóveis do mercado! 🎉</div>`;
    const mine = p.properties.length ? p.properties.map((x, i) => `<div class="card"><div class="row"><b>${G.PROP[x.key].icon} ${esc(G.PROP[x.key].name)}</b></div>
      <div class="kv"><div><span>Valor atual</span><b>${money(x.value)}</b></div><div><span>Aluguel mensal</span><b class="pos">+ ${money(x.rent)}</b></div></div>
      <button class="btn sm" style="width:100%" data-act="renovate" data-i="${i}">🛠️ Reformar (${money(G.renovateCost(x))})</button></div>`).join("") : `<div class="empty">Ainda não possuis imóveis adquiridos.</div>`;
    return `<div class="sec" style="margin-top:6px">Mercado imobiliário</div><div class="grid two">${market}</div><div class="sec">🏢 Meus imóveis &amp; valuation</div><div class="list">${mine}</div>`;
  }

  function viewBank(p) {
    return `<div class="card" style="margin-top:6px">Taxa de juros atual: <b>${(p.rate * 100).toFixed(1)}% ao mês</b><br>Saldo devedor: <b>${money(p.loan)}</b></div>
      <div class="sec">💰 Solicitar empréstimo</div><div class="inline"><input id="loan_in" type="number" inputmode="decimal" min="1000" step="1000" value="1000"><button class="btn sm" data-act="loan">Solicitar</button></div>
      <div class="sec">📉 Amortizar dívida</div><div class="inline"><input id="pay_in" type="number" inputmode="decimal" min="100" step="500" value="${Math.max(100, Math.min(p.loan, Math.floor(p.cash)) || 100)}"><button class="btn sm green" data-act="pay">Pagar</button></div>
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
    const held = G.stocksValue(p);
    const cards = G.STOCKS.map(s => {
      const m = p.market[s.ticker], h = m.history, prev = h.length > 1 ? h[h.length - 2] : m.price, ch = prev ? (m.price / prev - 1) * 100 : 0, q = p.shares[s.ticker] || 0;
      return `<div class="card"><div class="row"><b>${s.ticker}</b><span class="muted" style="font-size:12px">${esc(s.name)}</span></div>
        <div class="row" style="margin:6px 0"><div><div class="big">${money(m.price)}</div><small class="${ch < 0 ? "neg" : "pos"}">${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(1)}% no mês</small></div>${spark(h)}</div>
        <div class="muted" style="font-size:12px">Dividendo ${(s.yield * 100).toFixed(1)}% ao mês · Você tem <b>${q}</b> ação(ões) (${money(q * m.price)})</div>
        <div class="inline" style="margin-top:8px"><input id="stk_${s.ticker}" type="number" inputmode="numeric" min="1" step="1" value="1"><button class="btn sm" data-act="buy_sh" data-t="${s.ticker}">Comprar</button><button class="btn sm red" data-act="sell_sh" data-t="${s.ticker}" ${q ? "" : "disabled"}>Vender</button></div></div>`;
    }).join("");
    return `<div class="card" style="margin-top:6px"><div class="row"><span>📈 Valor da sua carteira</span><b style="color:var(--cyan)">${money(held)}</b></div>
      <div class="muted" style="font-size:12px;margin-top:4px">Os preços mudam a cada mês, e os dividendos caem no caixa. Como no jogo original, as ações não entram no Patrimônio Líquido.</div></div>
      <div class="sec">Ações da Urban Nex</div><div class="list">${cards}</div>`;
  }

  // ------------------------------------------------------------------ ofertas
  function viewOffers(p) {
    const offers = p.offers.length ? p.offers.map(o => {
      const biz = p.businesses.find(b => b.id === o.bizId), base = biz ? G.BIZ[biz.type].cost : 0, pr = base ? (o.price / base - 1) * 100 : 0;
      return `<div class="card"><div class="row"><b>📩 ${esc(o.name)}</b><span class="pos">${money(o.price)}</span></div>
        <div class="muted" style="font-size:13px;margin:4px 0 10px">Comprador: ${esc(o.buyer)}${base ? ` · ${pr >= 0 ? "+" : ""}${pr.toFixed(0)}% sobre o valor de compra (${money(base)})` : ""}</div>
        <div class="inline"><button class="btn sm green" data-act="accept_offer" data-id="${o.id}">Aceitar</button><button class="btn sm ghost" data-act="decline_offer" data-id="${o.id}">Recusar</button></div></div>`;
    }).join("") : `<div class="empty">Nenhuma proposta no momento.</div>`;
    const mine = p.businesses.length ? p.businesses.map((b, i) => { const d = G.BIZ[b.type];
      return `<div class="card row"><div><b>${d.icon} ${esc(d.name)}</b><div class="muted" style="font-size:12px">Valor de compra ${money(d.cost)}</div></div><button class="btn sm" data-act="ask_offer" data-i="${i}">Pedir proposta</button></div>`; }).join("")
      : `<div class="empty">Compre uma empresa para poder receber propostas.</div>`;
    return `<div class="sec" style="margin-top:6px">Propostas recebidas</div><div class="list">${offers}</div>
      <div class="sec">Pedir proposta de compra</div><div class="list">${mine}</div>
      <p class="muted" style="font-size:12px">Os investidores pagam entre 10% e 35% acima do valor de compra. Aceitar vende a empresa na hora.</p>`;
  }

  // ------------------------------------------------------------------ tempo
  function viewMonth(p) {
    const last = p.log.find(l => /^Mês \d+:/.test(l.text));
    return `<button class="btn go" data-act="advance">⚡ Avançar para o mês ${p.month + 1}</button>
      <p class="muted" style="font-size:13px;margin:8px 2px">Ao avançar, as empresas vendem, pagam custos e impostos, os imóveis rendem aluguel, as ações pagam dividendos, o banco cobra juros e um evento pode acontecer.</p>
      <div class="sec">📈 Evolução do patrimônio</div>${chart(p.history)}
      <div class="sec">📜 Últimos acontecimentos</div><div class="card log">${p.log.slice(0, 12).map(l => `<div>Mês ${l.month}: ${esc(l.text)}</div>`).join("") || "Nada ainda."}</div>`;
  }
  function viewReport(r) {
    const ev = r.event, kind = ev.type === "BOOM" ? "good" : ev.type === "NORMAL" ? "calm" : "bad";
    const biz = r.businesses.length ? r.businesses.map(b => `<div class="rep"><div class="row"><b>${esc(b.name)}</b><b class="${cls(b.net)}">${money(b.net)}</b></div><div class="muted" style="font-size:12px">Vendeu ${b.sold} un. · faturou ${money(b.gross)} · custos ${money(b.overhead)} · impostos ${money(b.tax)}</div></div>`).join("") : `<div class="muted">Você não tem empresas ativas.</div>`;
    const d = r.after - r.before;
    return `<div class="modal" data-act="report_close"><div class="box">
      <h3>📅 Relatório do mês ${r.month}</h3>
      <div class="ev ${kind}"><b>${esc(ev.name)}</b><br><small>${esc(ev.description)}</small></div>
      <div class="sec" style="margin-top:12px">Empresas</div>${biz}
      <div class="sec">Outras movimentações</div>
      <div class="kv"><div><span>Aluguéis</span><b class="pos">+ ${money(r.rent)}</b></div><div><span>Dividendos</span><b class="pos">+ ${money(r.dividends)}</b></div><div><span>Juros do banco</span><b class="${r.interest ? "neg" : ""}">${r.interest ? "- " : ""}${money(r.interest)}</b></div><div><span>Multa</span><b class="${r.fine ? "neg" : ""}">${r.fine ? "- " : ""}${money(r.fine)}</b></div></div>
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
    const p = u.game;
    const tabs = [["biz", "🏪", "Empresas"], ["re", "🏢", "Imóveis"], ["stock", "📈", "Bolsa"], ["offers", "📩", "Ofertas"], ["bank", "💳", "Banco"], ["month", "⚡", "Tempo"]];
    const body = { biz: viewBiz, re: viewRE, bank: viewBank, stock: viewStock, offers: viewOffers, month: viewMonth }[ui.tab](p);
    $app.innerHTML = `<div class="wrap">${hud(p)}${body}</div>
      <nav class="tabs">${tabs.map(([k, i, n]) => `<button data-act="tab" data-k="${k}" class="${ui.tab === k ? "on" : ""}">${i}<span>${n}</span></button>`).join("")}</nav>${ui.menu ? viewMenu(p) : ""}${ui.report ? viewReport(ui.report) : ""}`;
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
    do_register: async () => { try { await register(document.getElementById("au_name").value, document.getElementById("au_pass").value); ui.err = ""; ui.tab = "biz"; render(); } catch (e) { ui.err = e.message; document.getElementById("au_err").textContent = e.message; } },
    do_login: async () => { try { await login(document.getElementById("au_name").value, document.getElementById("au_pass").value); ui.err = ""; ui.tab = "biz"; render(); } catch (e) { ui.err = e.message; document.getElementById("au_err").textContent = e.message; } },
    tab: el => { ui.tab = el.dataset.k; render(); window.scrollTo(0, 0); },
    menu: () => { ui.menu = true; render(); },
    menu_close: () => { ui.menu = false; render(); },
    logout: () => { S.db.session = null; ui.menu = false; S.save(); render(); },
    backup: () => { const d = new Date(), z = n => String(n).padStart(2, "0"); download(`urban_nex_backup_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.json`, S.exportJSON()); toast("Cópia salva. Guarde o arquivo no Drive ou WhatsApp."); },
    buy_biz: el => { const d = G.BIZ[el.dataset.k]; G.buyBusiness(game(), el.dataset.k); toast(`${d.name} adquirido!`); },
    sell_biz: el => { const b = game().businesses[+el.dataset.i]; if (!b) return; if (!confirm(`Vender ${G.BIZ[b.type].name} por ${money(G.BIZ[b.type].cost * 0.9)}?`)) return; const v = G.sellBusiness(game(), +el.dataset.i); toast(`Empresa vendida por ${money(v)}.`); },
    restock: el => { const r = G.restock(game(), +el.dataset.i, num("rst_" + el.dataset.i)); toast(`+${r.units} unidades (${money(r.cost)}).`); },
    inject: el => { const v = num("inj_" + el.dataset.i); G.injectCapital(game(), +el.dataset.i, v); toast(`Aporte de ${money(v)} realizado!`); },
    buy_re: el => { G.buyProperty(game(), el.dataset.k); toast(`${G.PROP[el.dataset.k].name} comprado!`); },
    renovate: el => { const x = game().properties[+el.dataset.i]; G.renovate(game(), +el.dataset.i); toast(`${G.PROP[x.key].name} reformado!`); },
    loan: () => { const v = num("loan_in"); G.takeLoan(game(), v); toast(`Crédito de ${money(v)} depositado!`); },
    pay: () => { const v = G.payLoan(game(), num("pay_in")); toast(`Dívida abatida em ${money(v)}!`); },
    buy_sh: el => { const q = Math.floor(num("stk_" + el.dataset.t)); G.buyShares(game(), el.dataset.t, q); toast(`Comprou ${q} ${el.dataset.t}.`); },
    sell_sh: el => { const q = Math.floor(num("stk_" + el.dataset.t)); G.sellShares(game(), el.dataset.t, q); toast(`Vendeu ${q} ${el.dataset.t}.`); },
    ask_offer: el => { const v = G.requestOffer(game(), +el.dataset.i); toast(`Proposta recebida: ${money(v)}.`); },
    accept_offer: el => { const o = game().offers.find(x => x.id === el.dataset.id); if (!o) return; if (!confirm(`Vender ${o.name} por ${money(o.price)}?`)) return; G.acceptOffer(game(), o.id); toast(`Empresa vendida por ${money(o.price)}.`); },
    decline_offer: el => { G.declineOffer(game(), el.dataset.id); toast("Proposta recusada."); },
    advance: () => { const g = game(), before = G.netWorth(g), rep = G.advanceMonth(g); rep.before = before; rep.after = G.netWorth(g); ui.report = rep; },
    report_close: () => { ui.report = null; window.scrollTo(0, 0); },
    negotiate: () => { const [ok, msg] = G.negotiate(game()); toast(msg, !ok); },
  };
  $app.addEventListener("click", async e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    if (el.classList.contains("modal") && e.target !== el) return;
    const fn = actions[el.dataset.act]; if (!fn) return;
    try { await fn(el); if (S.db.session && !["menu", "menu_close", "auth", "tab", "backup"].includes(el.dataset.act)) { S.save(); render(); } }
    catch (err) { if (err instanceof G.GameError) toast(err.message, true); else { console.error(err); toast("Erro: " + err.message, true); } }
  });
  $app.addEventListener("change", e => { if (e.target.id === "bk_file" || e.target.id === "bk_file_auth") restoreFile(e.target.files[0]); });
  $app.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id && e.target.id.startsWith("au_")) { const b = $app.querySelector('[data-act="do_login"],[data-act="do_register"]'); if (b) b.click(); } });

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  S.open().then(() => { if (S.db.session && !S.db.users[S.db.session]) S.db.session = null; render(); window.__ready = true; });
})();
