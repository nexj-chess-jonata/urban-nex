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
  const restockUnitCost = b => r2(BIZ[b.type].rev * RESTOCK_RATE);

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

  const DISTRICTS = [
    { name: "Fase 1: Periferia Urbana", need: 0 },
    { name: "Fase 2: Bairro Comercial", need: 30000 },
    { name: "Fase 3: Centro Financeiro", need: 100000 },
    { name: "Fase 4: Distrito de Luxo & Tech", need: 350000 },
  ];

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
      cash: START_CASH, month: 1, businesses: [], properties: [], shares: {}, offers: [],
      loan: 0, rate: 0.025,
      market: Object.fromEntries(STOCKS.map(s => [s.ticker, { price: s.price, history: [s.price] }])),
      history: [],              // patrimônio no fim de cada mês (começa com o mês 1)
      log: [],                  // últimos acontecimentos
    };
  }
  function note(p, text) { p.log.unshift({ month: p.month, text }); if (p.log.length > 60) p.log.length = 60; }

  // ------------------------------------------------------------------ patrimônio e bairro
  const investedBusinesses = p => p.businesses.reduce((s, b) => s + BIZ[b.type].cost, 0);
  const investedRealEstate = p => p.properties.reduce((s, x) => s + x.value, 0);
  const netWorth = p => p.cash + investedBusinesses(p) + investedRealEstate(p) - p.loan;
  const stocksValue = p => Object.entries(p.shares).reduce((s, [t, q]) => s + q * p.market[t].price, 0);
  function district(p) {
    const nw = netWorth(p); let cur = DISTRICTS[0];
    for (const d of DISTRICTS) { if (nw >= d.need) cur = d; else break; }
    return cur;
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
  function makeBusiness(key) {
    const d = BIZ[key];
    return { id: newId(), type: key, stock: Math.floor(d.cap / 2), gross: 0, overhead: 0, tax: 0, net: 0, capital: 0 };
  }
  function buyBusiness(p, key) {
    const d = BIZ[key]; if (!d || d.hidden) throw new GameError("Empresa inválida.");
    spend(p, d.cost);
    p.businesses.push(makeBusiness(key));
    note(p, `Comprou ${d.name}.`);
    return p.businesses[p.businesses.length - 1];
  }
  const bizAt = (p, i) => { const b = p.businesses[i]; if (!b) throw new GameError("Empresa não encontrada."); return b; };
  function sellBusiness(p, i) {
    const b = bizAt(p, i), d = BIZ[b.type], value = r2(d.cost * 0.9);
    p.businesses.splice(i, 1); earn(p, value);
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
    const d = BIZ[b.type];
    const sold = R().randint(Math.floor(b.stock * 0.3), b.stock);
    const gross = sold * d.rev, tax = gross * TAX_RATE, overhead = d.overhead * (overheadMult || 1);
    b.gross = gross; b.overhead = overhead; b.tax = tax; b.net = gross - overhead - tax;
    b.capital = b.capital + b.net; b.stock -= sold;
    return { sold, gross, overhead, tax, net: b.net };
  }

  // ------------------------------------------------------------------ imóveis
  const availableProperties = p => PROPERTIES.filter(x => !p.properties.some(o => o.key === x.key));
  function buyProperty(p, key) {
    const d = PROP[key]; if (!d) throw new GameError("Imóvel inválido.");
    if (p.properties.some(o => o.key === key)) throw new GameError("Você já tem este imóvel.");
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

  // ------------------------------------------------------------------ banco
  function takeLoan(p, amount) {
    amount = +amount; if (!(amount >= 1000)) throw new GameError("O empréstimo mínimo é J$ 1.000,00.");
    p.loan = r2(p.loan + amount); earn(p, amount);
    note(p, `Pegou empréstimo de J$ ${amount.toFixed(2)}.`);
  }
  function payLoan(p, amount) {
    amount = +amount; if (!(amount >= 100)) throw new GameError("O pagamento mínimo é J$ 100,00.");
    if (p.loan <= 0) throw new GameError("Você não tem dívida.");
    amount = Math.min(amount, p.loan);
    spend(p, amount); p.loan = r2(p.loan - amount);
    note(p, `Pagou J$ ${amount.toFixed(2)} da dívida.`);
    return amount;
  }
  function negotiate(p) {
    const nw = netWorth(p);
    if (nw > 500000 && p.rate > 0.015) { p.rate = 0.015; return [true, "Taxa renegociada para 1.5% ao mês com sucesso!"]; }
    if (nw > 200000 && p.rate > 0.020) { p.rate = 0.020; return [true, "Taxa renegociada para 2.0% ao mês com sucesso!"]; }
    return [false, "O banco exige um Patrimônio Líquido superior a J$ 200.000,00 para renegociar taxas."];
  }

  // ------------------------------------------------------------------ bolsa (usada na etapa 2, já testada)
  function buyShares(p, ticker, qty) {
    qty = Math.floor(+qty); if (!STOCK[ticker] || !(qty >= 1)) throw new GameError("Quantidade inválida.");
    spend(p, r2(p.market[ticker].price * qty));
    p.shares[ticker] = (p.shares[ticker] || 0) + qty;
  }
  function sellShares(p, ticker, qty) {
    qty = Math.floor(+qty); if (!STOCK[ticker] || !(qty >= 1)) throw new GameError("Quantidade inválida.");
    if ((p.shares[ticker] || 0) < qty) throw new GameError("Quantidade insuficiente!");
    earn(p, r2(p.market[ticker].price * qty)); p.shares[ticker] -= qty;
  }

  // ------------------------------------------------------------------ ofertas (etapa 2)
  function requestOffer(p, i) {
    const b = bizAt(p, i);
    const price = r2(BIZ[b.type].cost * R().uniform(1.10, 1.35));
    p.offers.push({ id: newId(), buyer: "Fundo Capital Urbano", bizId: b.id, name: BIZ[b.type].name, price });
    return price;
  }
  function acceptOffer(p, offerId) {
    const k = p.offers.findIndex(o => o.id === offerId); if (k < 0) throw new GameError("Oferta não encontrada.");
    const o = p.offers[k], bi = p.businesses.findIndex(b => b.id === o.bizId);
    p.offers.splice(k, 1);
    if (bi < 0) throw new GameError("Essa empresa não existe mais.");
    p.businesses.splice(bi, 1); earn(p, o.price);
    note(p, `Vendeu ${o.name} para o ${o.buyer} por J$ ${o.price.toFixed(2)}.`);
  }
  function declineOffer(p, offerId) { p.offers = p.offers.filter(o => o.id !== offerId); }

  // ------------------------------------------------------------------ avançar o mês (etapa 2)
  function pickEvent() { return R().random() < 0.5 ? EVENTS[0] : R().choice(EVENTS.slice(1)); }
  function advanceMonth(p, forcedEvent) {
    p.month += 1;
    const ev = forcedEvent || pickEvent(), rep = { month: p.month, event: ev, businesses: [], rent: 0, dividends: 0, interest: 0, fine: ev.fine || 0 };
    if (ev.fine) { p.cash = r2(p.cash - ev.fine); }
    for (const b of p.businesses) {
      const r = processBusiness(b, ev.cost_multiplier);
      const gross = r.gross * (ev.multiplier || 1);
      p.cash = r2(p.cash - r.overhead + gross - r.tax);
      b.gross = gross; b.net = gross - r.overhead - r.tax; b.capital = b.capital - r.net + b.net;
      rep.businesses.push({ name: BIZ[b.type].name, sold: r.sold, gross, overhead: r.overhead, tax: r.tax, net: b.net });
    }
    for (const x of p.properties) {
      rep.rent += x.rent; x.value = x.value * (1 + R().uniform(-0.05, 0.08));
    }
    earn(p, rep.rent);
    for (const s of STOCKS) {
      const m = p.market[s.ticker];
      m.price = Math.max(1, r2(m.price * (1 + R().uniform(-s.vol, s.vol)) * (ev.multiplier || 1)));
      m.history.push(m.price); if (m.history.length > 60) m.history.shift();
      const q = p.shares[s.ticker] || 0;
      if (q > 0) { const dv = r2(q * m.price * s.yield); rep.dividends += dv; earn(p, dv); }
    }
    if (p.loan > 0) { rep.interest = r2(p.loan * p.rate); p.loan = r2(p.loan + rep.interest); }
    p.history.push(r2(netWorth(p)));
    note(p, `${ev.name}.`);
    return rep;
  }

  root.UN = {
    GameError, BIZ, BIZ_STORE, BIZ_BY_NAME, PROPERTIES, PROP, PROP_BY_NAME, STOCKS, STOCK, DISTRICTS, EVENTS, START_CASH, TAX_RATE, RESTOCK_RATE,
    newGame, netWorth, investedBusinesses, investedRealEstate, stocksValue, district, nextGoal,
    buyBusiness, sellBusiness, injectCapital, restock, restockCost, restockUnitCost,
    availableProperties, buyProperty, renovate, renovateCost,
    takeLoan, payLoan, negotiate, buyShares, sellShares, requestOffer, acceptOffer, declineOffer, advanceMonth, note,
  };
})(typeof self !== "undefined" ? self : this);
