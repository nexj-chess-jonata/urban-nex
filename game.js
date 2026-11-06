/* Urban Nex (celular) — regras do jogo. Porta de businesses.py, real_estate.py, stock_market.py, finance.py,
 * districts.py, events_and_taxes.py e das ações do app.py. Funções puras: recebem os dados do jogador (p) e mexem neles. */
(function (root) {
  "use strict";
  const U = root.NJUtil;
  const R = () => U.rnd;
  const r2 = x => Math.round(x * 100) / 100;
  class GameError extends Error {}

  // ------------------------------------------------------------------ catálogos
  // [chave, nome, setor, custo, custo fixo mensal, receita por unidade, capacidade, emoji, setor mostrado na loja]
  const BIZ_ROWS = [
    ["cart", "Carrinho de Lanche", "Alimentação Rápida", 1500, 200, 15, 100, "🍔", "Alimentação"],
    ["clothes", "Loja de Roupas", "Varejo", 12000, 1500, 80, 300, "👕", "Varejo"],
    ["restaurant", "Restaurante Típico", "Alimentação & Serviços", 45000, 5000, 60, 800, "🍝", "Alimentação"],
    ["market", "Supermercado de Bairro", "Varejo", 85000, 9500, 45, 2500, "🛒", "Varejo"],
    ["gas", "Posto de Combustível", "Energia & Serviços", 180000, 16000, 22, 2000, "⛽", "Energia"],
    ["cars", "Concessionária de Veículos", "Automotivo", 250000, 30000, 8500, 50, "🚗", "Automotivo"],
    ["fastfood", "Franquia Fast Food", "Alimentação Rápida", 320000, 28000, 35, 1800, "🍕", "Alimentação"],
    ["ai", "Startup de I.A.", "Tecnologia", 650000, 60000, 3500, 150, "🤖", "Tecnologia"],
    // existem no código original, mas não aparecem na loja (ficam só para carregar saves antigos)
    ["logistics", "Empresa de Logística", "Transportes & Carga", 500000, 45000, 2200, 400, "🚚", "Transportes", true],
    ["hotel", "Rede de Hotéis Urbanos", "Turismo & Hospitalidade", 1200000, 90000, 450, 3000, "🏨", "Turismo", true],
    ["tech", "Tech Startup", "Tecnologia", 300000, 25000, 1200, 500, "💻", "Tecnologia", true],
    ["furniture", "Fábrica de Móveis", "Indústria", 150000, 18000, 350, 1000, "🪑", "Indústria", true],
  ];
  const BIZ = {};
  for (const [key, name, sector, cost, overhead, rev, cap, icon, label, hidden] of BIZ_ROWS)
    BIZ[key] = { key, name, sector, cost, overhead, rev, cap, icon, label, hidden: !!hidden };
  const BIZ_STORE = BIZ_ROWS.filter(r => !r[9]).map(r => r[0]);
  const BIZ_BY_NAME = Object.fromEntries(Object.values(BIZ).map(b => [b.name, b.key]));
  const RESTOCK_RATE = 0.25;           // custo de repor 1 unidade = 25% do que ela rende (decisão do app do celular)

  const PROPERTIES = [
    { key: "galpao", name: "Galpão Industrial", price: 20000, rent: 800, icon: "🏭" },
    { key: "edificio", name: "Edifício Residencial", price: 75000, rent: 3200, icon: "🏢" },
    { key: "hotel", name: "Hotel Executivo", price: 200000, rent: 9500, icon: "🏨" },
  ];
  const PROP = Object.fromEntries(PROPERTIES.map(x => [x.key, x]));
  const PROP_BY_NAME = Object.fromEntries(PROPERTIES.map(x => [x.name, x.key]));

  const STOCKS = [
    { ticker: "UNX", name: "Urban Tech Corp", price: 150, yield: 0.012, vol: 0.08 },
    { ticker: "NXB", name: "Nex Bank Group", price: 80, yield: 0.015, vol: 0.04 },
    { ticker: "IMV", name: "Imobiliária Central", price: 210, yield: 0.010, vol: 0.05 },
    { ticker: "LOG", name: "Logística Urbana S.A.", price: 45, yield: 0.018, vol: 0.06 },
  ];
  const STOCK = Object.fromEntries(STOCKS.map(s => [s.ticker, s]));

  // [nome, nome curto, patrimônio para abrir, demanda ×, custo fixo ×, preço ×, preço do terreno base, ícone]
  const DISTRICTS = [
    ["Fase 1: Periferia Urbana", "Periferia", 0, 1.0, 1.0, 1.0, 8000, "🏚️"],
    ["Fase 2: Bairro Comercial", "Bairro Comercial", 30000, 1.8, 1.5, 1.5, 25000, "🏬"],
    ["Fase 3: Centro Financeiro", "Centro Financeiro", 100000, 3.0, 2.5, 2.5, 70000, "🏙️"],
    ["Fase 4: Distrito de Luxo & Tech", "Distrito de Luxo", 350000, 5.5, 4.0, 4.0, 200000, "🌆"],
  ].map(([name, short, need, demand, overhead, price, plot, icon], i) => ({ i, name, short, need, demand, overhead, price, plot, icon }));
  // em qual bairro cada negócio / imóvel passa a ser vendido
  const BIZ_LEVEL = { cart: 0, clothes: 0, restaurant: 0, market: 1, gas: 1, cars: 2, fastfood: 2, ai: 3, logistics: 3, hotel: 3, tech: 3, furniture: 3 };
  const PROP_LEVEL = { galpao: 0, edificio: 1, hotel: 2 };
  const PLOTS = [];
  DISTRICTS.forEach(d => [1, 2, 3].forEach((n, k) => PLOTS.push({ id: `t${d.i}_${n}`, level: d.i, name: `Lote ${n} · ${d.short}`, price: Math.round(d.plot * (1 + 0.15 * k)) })));
  const PLOT = Object.fromEntries(PLOTS.map(x => [x.id, x]));
  const MONTHS_OPTS = [6, 12, 18, 24, 36, 48];
  const SEIZE_RATE = 0.7, MAX_LATE = 3, LATE_FINE = 0.02, RESTART_CASH = 10000;

  const EVENTS = [
    { name: "Nenhum Evento", description: "Mercado estável neste mês.", type: "NORMAL" },
    { name: "🚀 Boom Econômico", description: "Aumento no consumo! Vendas multiplicadas em 1.5x.", type: "BOOM", multiplier: 1.5 },
    { name: "📦 Crise de Abastecimento", description: "Insumos e custos operacionais ficaram 1.3x mais caros neste mês.", type: "SUPPLY_CRISIS", cost_multiplier: 1.3 },
    { name: "📋 Auditoria Fiscal", description: "Fiscalização encontrou inconsistências. Multa de J$ 500,00 aplicada.", type: "AUDIT", fine: 500 },
  ];
  const TAX_RATE = 0.10;
  const START_CASH = 50000;

  // ------------------------------------------------------------------ jogador novo
  function newGame() {
    return {
      v: 2, cash: START_CASH, month: 1, level: 0, businesses: [], properties: [], terrains: [], shares: {}, basis: {}, offers: [],
      loan: 0, loans: [], rate: 0.025, bankruptcies: 0,
      market: Object.fromEntries(STOCKS.map(s => [s.ticker, { price: s.price, history: [s.price] }])),
      history: [],              // patrimônio no fim de cada mês (começa com o mês 1)
      reports: [],              // relatórios dos meses (mais novo primeiro)
      log: [],                  // últimos acontecimentos
    };
  }
  function note(p, text) { p.log.unshift({ month: p.month, text }); if (p.log.length > 60) p.log.length = 60; }
  const fm = n => "J$ " + (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ------------------------------------------------------------------ patrimônio e bairro
  const paidOf = b => (b.paid != null ? b.paid : BIZ[b.type].cost);
  const investedBusinesses = p => p.businesses.reduce((s, b) => s + paidOf(b), 0);
  const investedRealEstate = p => p.properties.reduce((s, x) => s + x.value, 0) + (p.terrains || []).reduce((s, x) => s + x.value, 0);
  const netWorth = p => p.cash + investedBusinesses(p) + investedRealEstate(p) - p.loan;
  const stocksValue = p => Object.entries(p.shares).reduce((s, [t, q]) => s + q * p.market[t].price, 0);
  function levelByNet(p) { const nw = netWorth(p); let l = 0; for (const d of DISTRICTS) if (nw >= d.need) l = d.i; return l; }
  const level = p => Math.max(p.level || 0, levelByNet(p));       // bairros já abertos nunca fecham
  function district(p) { const l = level(p); p.level = l; return DISTRICTS[l]; }
  function syncLevel(p) {      // devolve o bairro recém-aberto (ou null)
    const before = p.level || 0, l = level(p); p.level = l;
    if (l > before) { note(p, `Novo bairro desbloqueado: ${DISTRICTS[l].name}!`); return DISTRICTS[l]; }
    return null;
  }
  function nextGoal(p) {
    const nw = netWorth(p);
    for (const d of DISTRICTS) if (nw < d.need) return { name: d.name, target: d.need, remaining: d.need - nw };
    return { name: "Topo do Mundo (Nível Máximo Alcançado!)", target: 0, remaining: 0 };
  }

  // ------------------------------------------------------------------ dinheiro
  function spend(p, amount, why) {
    if (!(amount > 0)) throw new GameError("Valor inválido.");
    if (p.cash < amount) throw new GameError("Saldo insuficiente!");
    p.cash = r2(p.cash - amount);
  }
  const earn = (p, amount) => { p.cash = r2(p.cash + amount); };

  // ------------------------------------------------------------------ empresas
  let seq = 0;
  const newId = () => Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const bizCost = (key, dist) => r2(BIZ[key].cost * DISTRICTS[dist || 0].price);
  const restockUnitCost = b => r2(BIZ[b.type].rev * DISTRICTS[b.dist || 0].demand * RESTOCK_RATE);
  function makeBusiness(key, dist) {
    const d = BIZ[key];
    return { id: newId(), type: key, dist: dist || 0, paid: bizCost(key, dist), stock: Math.floor(d.cap / 2), gross: 0, overhead: 0, tax: 0, net: 0, capital: 0 };
  }
  function buyBusiness(p, key, dist) {
    dist = dist || 0;
    const d = BIZ[key]; if (!d || d.hidden) throw new GameError("Empresa inválida.");
    if (BIZ_LEVEL[key] > level(p)) throw new GameError(`Este negócio só abre no ${DISTRICTS[BIZ_LEVEL[key]].short}.`);
    if (!DISTRICTS[dist] || dist > level(p)) throw new GameError("Esse bairro ainda está bloqueado.");
    spend(p, bizCost(key, dist));
    p.businesses.push(makeBusiness(key, dist));
    note(p, `Comprou ${d.name} (${DISTRICTS[dist].short}).`);
    return p.businesses[p.businesses.length - 1];
  }
  const bizAt = (p, i) => { const b = p.businesses[i]; if (!b) throw new GameError("Empresa não encontrada."); return b; };
  const sellValue = b => r2(paidOf(b) * 0.9);
  function sellBusiness(p, i) {
    const b = bizAt(p, i), d = BIZ[b.type], value = sellValue(b);
    p.businesses.splice(i, 1); earn(p, value);
    p.offers = p.offers.filter(o => o.bizId !== b.id);
    note(p, `Vendeu ${d.name} por J$ ${value.toFixed(2)}.`);
    return value;
  }
  function injectCapital(p, i, amount) {
    const b = bizAt(p, i); amount = +amount;
    if (!(amount >= 100)) throw new GameError("O aporte mínimo é J$ 100,00.");
    spend(p, amount); b.capital = r2(b.capital + amount);
    note(p, `Aporte de J$ ${amount.toFixed(2)} em ${BIZ[b.type].name}.`);
  }
  function restockCost(b, units) { return r2(units * restockUnitCost(b)); }
  function restock(p, i, units) {
    const b = bizAt(p, i), d = BIZ[b.type];
    const room = d.cap - b.stock;
    units = Math.min(Math.floor(+units), room);
    if (!(units > 0)) throw new GameError(room <= 0 ? "O estoque já está cheio." : "Quantidade inválida.");
    const cost = restockCost(b, units); spend(p, cost);
    b.stock += units;
    note(p, `Repôs ${units} un. em ${d.name} (J$ ${cost.toFixed(2)}).`);
    return { units, cost };
  }
  function processBusiness(b, overheadMult) {
    const d = BIZ[b.type], dd = DISTRICTS[b.dist || 0];
    const sold = R().randint(Math.floor(b.stock * 0.3), b.stock);
    const gross = sold * d.rev * dd.demand, tax = gross * TAX_RATE, overhead = d.overhead * dd.overhead * (overheadMult || 1);
    b.gross = gross; b.overhead = overhead; b.tax = tax; b.net = gross - overhead - tax;
    b.capital = b.capital + b.net; b.stock -= sold;
    return { sold, gross, overhead, tax, net: b.net };
  }

  // ------------------------------------------------------------------ imóveis
  const availableProperties = p => PROPERTIES.filter(x => !p.properties.some(o => o.key === x.key) && PROP_LEVEL[x.key] <= level(p));
  const lockedProperties = p => PROPERTIES.filter(x => PROP_LEVEL[x.key] > level(p));
  function buyProperty(p, key) {
    const d = PROP[key]; if (!d) throw new GameError("Imóvel inválido.");
    if (p.properties.some(o => o.key === key)) throw new GameError("Você já tem este imóvel.");
    if (PROP_LEVEL[key] > level(p)) throw new GameError(`Este imóvel só aparece no ${DISTRICTS[PROP_LEVEL[key]].short}.`);
    spend(p, d.price);
    p.properties.push({ key, price: d.price, value: d.price, rent: d.rent });
    note(p, `Comprou ${d.name}.`);
  }
  const renovateCost = x => r2(x.value * 0.15);
  function renovate(p, i) {
    const x = p.properties[i]; if (!x) throw new GameError("Imóvel não encontrado.");
    spend(p, renovateCost(x));
    x.value = x.value * 1.25; x.rent = x.rent * 1.30;
    note(p, `Reformou ${PROP[x.key].name}.`);
  }

  // ------------------------------------------------------------------ terrenos
  const availableTerrains = p => PLOTS.filter(x => x.level <= level(p) && !p.terrains.some(t => t.id === x.id));
  function buyTerrain(p, id) {
    const d = PLOT[id]; if (!d) throw new GameError("Terreno inválido.");
    if (d.level > level(p)) throw new GameError("Esse bairro ainda está bloqueado.");
    if (p.terrains.some(t => t.id === id)) throw new GameError("Você já tem este terreno.");
    spend(p, d.price); p.terrains.push({ id, price: d.price, value: d.price });
    note(p, `Comprou o terreno ${d.name}.`);
  }
  const terrainSellValue = t => r2(t.value * 0.95);
  function sellTerrain(p, i) {
    const t = p.terrains[i]; if (!t) throw new GameError("Terreno não encontrado.");
    const v = terrainSellValue(t); p.terrains.splice(i, 1); earn(p, v);
    note(p, `Vendeu o terreno ${PLOT[t.id].name} por J$ ${v.toFixed(2)}.`);
    return v;
  }

  // ------------------------------------------------------------------ banco (empréstimo parcelado, tabela Price)
  const pmtOf = (B, r, n) => (r > 0 ? B * r / (1 - Math.pow(1 + r, -n)) : B / n);
  function simulateLoan(amount, months, rate) {
    amount = +amount; months = Math.floor(+months);
    if (!(amount > 0) || !(months >= 1)) return null;
    const pmt = r2(pmtOf(amount, rate, months)), total = r2(pmt * months);
    return { amount, months, rate, pmt, total, interest: r2(total - amount) };
  }
  const syncLoan = p => { p.loan = r2(p.loans.reduce((s, l) => s + l.balance, 0)); };
  function takeLoan(p, amount, months) {
    amount = +amount; months = Math.floor(+months || 12);
    if (!(amount >= 1000)) throw new GameError("O empréstimo mínimo é J$ 1.000,00.");
    if (!(months >= 3 && months <= 60)) throw new GameError("Escolha entre 3 e 60 parcelas.");
    const l = { id: newId(), principal: r2(amount), balance: r2(amount), rate: p.rate, n: months, left: months, pmt: r2(pmtOf(amount, p.rate, months)), late: 0, since: p.month };
    p.loans.push(l); earn(p, amount); syncLoan(p);
    note(p, `Pegou empréstimo de J$ ${amount.toFixed(2)} em ${months} parcelas de J$ ${l.pmt.toFixed(2)}.`);
    return l;
  }
  function payLoan(p, amount, loanId) {
    amount = +amount;
    const targets = loanId ? p.loans.filter(l => l.id === loanId) : p.loans.slice().sort((a, b) => b.rate - a.rate);
    const total = targets.reduce((s, l) => s + l.balance, 0);
    if (!targets.length || total <= 0) throw new GameError("Você não tem dívida.");
    if (!(amount >= 100) && !(amount >= total)) throw new GameError("O pagamento mínimo é J$ 100,00.");
    amount = r2(Math.min(amount, total));
    spend(p, amount);
    let left = amount;
    for (const l of targets) {
      if (left <= 0) break;
      const x = r2(Math.min(left, l.balance)); l.balance = r2(l.balance - x); left = r2(left - x);
      if (l.balance <= 0.005) p.loans = p.loans.filter(o => o !== l);
      else if (l.left > 0) l.pmt = r2(pmtOf(l.balance, l.rate, l.left));       // pagou a mais: parcela diminui
    }
    syncLoan(p);
    note(p, `Pagou J$ ${amount.toFixed(2)} da dívida.`);
    return amount;
  }
  function negotiate(p) {
    const nw = netWorth(p); let r = 0, msg = "";
    if (nw > 500000 && p.rate > 0.015) { r = 0.015; msg = "Taxa renegociada para 1.5% ao mês com sucesso!"; }
    else if (nw > 200000 && p.rate > 0.020) { r = 0.020; msg = "Taxa renegociada para 2.0% ao mês com sucesso!"; }
    if (!r) return [false, "O banco exige um Patrimônio Líquido superior a J$ 200.000,00 para renegociar taxas."];
    p.rate = r;
    for (const l of p.loans) { l.rate = Math.min(l.rate, r); if (l.left > 0) l.pmt = r2(pmtOf(l.balance, l.rate, l.left)); }   // contratos antigos também melhoram
    return [true, msg];
  }
  const nextInstallments = p => r2(p.loans.reduce((s, l) => s + (l.left > 1 ? Math.min(l.pmt, r2(l.balance * (1 + l.rate))) : r2(l.balance * (1 + l.rate))), 0));

  function processLoans(p, rep) {
    rep.interest = 0; rep.installments = 0; rep.fines = 0; rep.late = []; rep.paidOff = 0;
    for (const l of p.loans.slice()) {
      const interest = r2(l.balance * l.rate); l.balance = r2(l.balance + interest); rep.interest = r2(rep.interest + interest);
      const due = l.left > 1 ? Math.min(l.pmt, l.balance) : l.balance;      // última parcela fecha o saldo (centavos de arredondamento)
      if (p.cash >= due) { p.cash = r2(p.cash - due); l.balance = r2(l.balance - due); l.late = 0; rep.installments = r2(rep.installments + due); if (l.left > 0) l.left--; }
      else { l.late++; const f = r2(due * LATE_FINE); l.balance = r2(l.balance + f); rep.fines = r2(rep.fines + f); rep.late.push(`Parcela de ${fm(due)} atrasada (${l.late}/${MAX_LATE})`); }
      if (l.balance <= 0.005) { p.loans = p.loans.filter(o => o !== l); rep.paidOff++; }
    }
    syncLoan(p);
  }
  function restart(p) {                 // falência: começa de novo com pouco dinheiro
    const keep = { log: p.log, reports: p.reports, bankruptcies: (p.bankruptcies || 0) + 1, month: p.month };
    const fresh = newGame(); fresh.cash = RESTART_CASH;
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, fresh, keep);
  }
  function seizeAssets(p, rep) {        // 3 parcelas atrasadas: o banco leiloa bens (70% do valor)
    if (!p.loans.some(l => l.late >= MAX_LATE)) return;
    const debt = p.loan, assets = [];
    p.businesses.forEach(b => assets.push({ v: r2(paidOf(b) * SEIZE_RATE), name: BIZ[b.type].name, rm: () => { p.businesses = p.businesses.filter(o => o !== b); p.offers = p.offers.filter(o => o.bizId !== b.id); } }));
    p.properties.forEach(x => assets.push({ v: r2(x.value * SEIZE_RATE), name: PROP[x.key].name, rm: () => { p.properties = p.properties.filter(o => o !== x); } }));
    p.terrains.forEach(t => assets.push({ v: r2(t.value * SEIZE_RATE), name: "Terreno " + PLOT[t.id].name, rm: () => { p.terrains = p.terrains.filter(o => o !== t); } }));
    const sv = r2(stocksValue(p) * SEIZE_RATE);
    if (sv > 0) assets.push({ v: sv, name: "Carteira de ações", rm: () => { p.shares = {}; p.basis = {}; } });
    assets.sort((a, b) => b.v - a.v);
    let got = 0; rep.seized = [];
    for (const a of assets) { if (got >= debt) break; a.rm(); got = r2(got + a.v); rep.seized.push(a.name); }
    if (got >= debt) {
      earn(p, r2(got - debt)); p.loans = []; syncLoan(p);
      note(p, `O banco leiloou ${rep.seized.join(", ")} para cobrir a dívida.`);
    } else { rep.bankrupt = true; note(p, "Falência! O banco tomou tudo e você recomeçou."); restart(p); }
  }

  // ------------------------------------------------------------------ bolsa
  const avgPrice = (p, t) => { const q = p.shares[t] || 0; return q > 0 ? (p.basis[t] || 0) / q : 0; };
  function buyShares(p, ticker, qty) {
    qty = Math.floor(+qty); if (!STOCK[ticker] || !(qty >= 1)) throw new GameError("Quantidade inválida.");
    const cost = r2(p.market[ticker].price * qty); spend(p, cost);
    p.shares[ticker] = (p.shares[ticker] || 0) + qty; p.basis[ticker] = r2((p.basis[ticker] || 0) + cost);
  }
  function sellShares(p, ticker, qty) {
    qty = Math.floor(+qty); if (!STOCK[ticker] || !(qty >= 1)) throw new GameError("Quantidade inválida.");
    if ((p.shares[ticker] || 0) < qty) throw new GameError("Quantidade insuficiente!");
    const proceeds = r2(p.market[ticker].price * qty), cost = r2(avgPrice(p, ticker) * qty);
    earn(p, proceeds); p.shares[ticker] -= qty; p.basis[ticker] = r2(Math.max(0, (p.basis[ticker] || 0) - cost));
    if (p.shares[ticker] <= 0) { delete p.shares[ticker]; delete p.basis[ticker]; }
    return { proceeds, profit: r2(proceeds - cost) };
  }
  function stockPnl(p, t) {         // lucro/prejuízo da posição atual
    const q = p.shares[t] || 0; if (!q) return { q: 0, avg: 0, value: 0, cost: 0, pnl: 0, pct: 0 };
    const value = r2(q * p.market[t].price), cost = r2(p.basis[t] || 0);
    return { q, avg: r2(cost / q), value, cost, pnl: r2(value - cost), pct: cost > 0 ? (value / cost - 1) * 100 : 0 };
  }

  // ------------------------------------------------------------------ ofertas
  const BUYERS = ["Fundo Capital Urbano", "Grupo Nexus Capital", "Investidor Anônimo", "Holding Metrópole"];
  const OFFER_MONTHS = 3;
  function requestOffer(p, i) {
    const b = bizAt(p, i);
    const price = r2(paidOf(b) * R().uniform(1.10, 1.35));
    p.offers.push({ id: newId(), buyer: "Fundo Capital Urbano", bizId: b.id, name: BIZ[b.type].name, price, exp: p.month + OFFER_MONTHS });
    return price;
  }
  function acceptOffer(p, offerId) {
    const k = p.offers.findIndex(o => o.id === offerId); if (k < 0) throw new GameError("Oferta não encontrada.");
    const o = p.offers[k], bi = p.businesses.findIndex(b => b.id === o.bizId);
    p.offers.splice(k, 1);
    if (bi < 0) throw new GameError("Essa empresa não existe mais.");
    p.businesses.splice(bi, 1); earn(p, o.price);
    p.offers = p.offers.filter(x => x.bizId !== o.bizId);
    note(p, `Vendeu ${o.name} para o ${o.buyer} por J$ ${o.price.toFixed(2)}.`);
  }
  function declineOffer(p, offerId) { p.offers = p.offers.filter(o => o.id !== offerId); }

  // ------------------------------------------------------------------ avisos (sino)
  function alerts(p) {
    const out = [], add = (sev, tab, text) => out.push({ sev, tab, text });
    for (const l of p.loans) if (l.late > 0) add("bad", "bank", `Parcela atrasada (${l.late}/${MAX_LATE}). Com ${MAX_LATE} atrasos o banco toma seus bens!`);
    const due = nextInstallments(p);
    if (due > 0 && p.cash < due) add("bad", "bank", `Caixa insuficiente para a parcela do mês que vem (${fm(due)}).`);
    for (const o of p.offers) add("info", "biz", `Proposta de ${fm(o.price)} pela ${o.name}${o.exp ? ` (vale até o mês ${o.exp})` : ""}.`);
    for (const b of p.businesses) {
      const d = BIZ[b.type];
      if (b.stock === 0) add("bad", "biz", `${d.name} está sem estoque. Não vende nada!`);
      else if (b.stock < d.cap * 0.25) add("warn", "biz", `${d.name} com estoque baixo (${b.stock}/${d.cap}).`);
    }
    for (const t of Object.keys(p.shares)) {
      const x = stockPnl(p, t);
      if (x.pct >= 20) add("info", "stock", `${t} está ${x.pct.toFixed(0)}% acima do seu preço médio (lucro de ${fm(x.pnl)}). Bom momento para vender?`);
      else if (x.pct <= -20) add("warn", "stock", `${t} está ${Math.abs(x.pct).toFixed(0)}% abaixo do seu preço médio (prejuízo de ${fm(-x.pnl)}).`);
    }
    return out;
  }

  // ------------------------------------------------------------------ avançar o mês
  function pickEvent() { return R().random() < 0.5 ? EVENTS[0] : R().choice(EVENTS.slice(1)); }
  function advanceMonth(p, forcedEvent) {
    const before = netWorth(p);
    p.month += 1;
    const ev = forcedEvent || pickEvent(), rep = { month: p.month, event: ev, businesses: [], rent: 0, dividends: 0, interest: 0, installments: 0, fines: 0, late: [], paidOff: 0, fine: ev.fine || 0, seized: [], bankrupt: false, newOffers: 0, expiredOffers: 0, unlocked: null, before };
    if (ev.fine) { p.cash = r2(p.cash - ev.fine); }
    for (const b of p.businesses) {
      const r = processBusiness(b, ev.cost_multiplier);
      const gross = r.gross * (ev.multiplier || 1);
      p.cash = r2(p.cash - r.overhead + gross - r.tax);
      b.gross = gross; b.net = gross - r.overhead - r.tax; b.capital = b.capital - r.net + b.net;
      rep.businesses.push({ name: BIZ[b.type].name, sold: r.sold, gross, overhead: r.overhead, tax: r.tax, net: b.net });
    }
    for (const x of p.properties) { rep.rent += x.rent; x.value = x.value * (1 + R().uniform(-0.05, 0.08)); }
    for (const t of p.terrains) t.value = r2(t.value * (1 + R().uniform(-0.03, 0.07)));
    earn(p, rep.rent);
    for (const s of STOCKS) {
      const m = p.market[s.ticker];
      m.price = Math.max(1, r2(m.price * (1 + R().uniform(-s.vol, s.vol)) * (ev.multiplier || 1)));
      m.history.push(m.price); if (m.history.length > 60) m.history.shift();
      const q = p.shares[s.ticker] || 0;
      if (q > 0) { const dv = r2(q * m.price * s.yield); rep.dividends += dv; earn(p, dv); }
    }
    processLoans(p, rep);
    seizeAssets(p, rep);
    if (rep.bankrupt) { rep.after = netWorth(p); p.history.push(r2(rep.after)); p.reports.unshift(rep); return rep; }
    // propostas: vencem depois de 3 meses; empresas podem receber propostas sozinhas
    const alive = p.offers.filter(o => !o.exp || o.exp >= p.month); rep.expiredOffers = p.offers.length - alive.length; p.offers = alive;
    for (const b of p.businesses) {
      if (!p.offers.some(o => o.bizId === b.id) && R().random() < 0.08) {
        p.offers.push({ id: newId(), buyer: R().choice(BUYERS), bizId: b.id, name: BIZ[b.type].name, price: r2(paidOf(b) * R().uniform(1.10, 1.35)), exp: p.month + OFFER_MONTHS });
        rep.newOffers++;
      }
    }
    const up = syncLevel(p); if (up) rep.unlocked = up.name;
    rep.after = r2(netWorth(p));
    p.history.push(rep.after);
    p.reports.unshift(rep); if (p.reports.length > 36) p.reports.length = 36;
    note(p, `${ev.name}.`);
    return rep;
  }

  // ------------------------------------------------------------------ saves antigos
  function migrate(p) {
    if (p.v === 2) return p;
    p.level = Math.max(p.level || 0, levelByNet(p));
    p.loans = p.loans || []; p.terrains = p.terrains || []; p.reports = p.reports || []; p.basis = p.basis || {}; p.bankruptcies = p.bankruptcies || 0;
    if (!p.loans.length && p.loan > 0) { const n = 12; p.loans.push({ id: newId(), principal: p.loan, balance: p.loan, rate: p.rate, n, left: n, pmt: r2(pmtOf(p.loan, p.rate, n)), late: 0, since: p.month }); }
    for (const t of Object.keys(p.shares)) if (p.basis[t] == null) p.basis[t] = r2(p.shares[t] * p.market[t].price);
    for (const b of p.businesses) { if (b.dist == null) b.dist = 0; if (b.paid == null) b.paid = BIZ[b.type].cost; }
    for (const o of p.offers) if (o.exp == null) o.exp = p.month + OFFER_MONTHS;
    syncLoan(p); p.v = 2; return p;
  }

  root.UN = {
    GameError, BIZ, BIZ_STORE, BIZ_BY_NAME, BIZ_LEVEL, PROPERTIES, PROP, PROP_LEVEL, PROP_BY_NAME, PLOTS, PLOT, STOCKS, STOCK, DISTRICTS, EVENTS, MONTHS_OPTS,
    START_CASH, TAX_RATE, RESTOCK_RATE, MAX_LATE, SEIZE_RATE, RESTART_CASH,
    newGame, migrate, netWorth, investedBusinesses, investedRealEstate, stocksValue, district, level, syncLevel, nextGoal, paidOf, bizCost, sellValue,
    buyBusiness, sellBusiness, injectCapital, restock, restockCost, restockUnitCost,
    availableProperties, lockedProperties, buyProperty, renovate, renovateCost,
    availableTerrains, buyTerrain, sellTerrain, terrainSellValue,
    simulateLoan, takeLoan, payLoan, negotiate, nextInstallments,
    buyShares, sellShares, stockPnl, avgPrice, requestOffer, acceptOffer, declineOffer, alerts, advanceMonth, note, fm,
  };
})(typeof self !== "undefined" ? self : this);
