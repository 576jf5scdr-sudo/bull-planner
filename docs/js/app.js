// Bull Planner: paste a Solana mint, get a verdict, entry zone, take-profits and stop-loss.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var GREEN = "#1F9D63", ORANGE = "#FF6A1A", RED = "#E5484D", BLUE = "#3B6FF0";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fp(p) { if (!(p > 0)) return "-"; if (p >= 1) return "$" + p.toFixed(4); var d = Math.max(2, -Math.floor(Math.log10(p)) + 3); return "$" + p.toFixed(Math.min(d, 12)); }
  function kusd(v) { if (v == null || isNaN(v)) return "—"; return v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + (v / 1e3).toFixed(1) + "K"; }
  function pct(v) { return v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(1) + "%"; }
  function age(h) { if (h == null) return "—"; return h < 1 ? Math.round(h * 60) + "m" : h < 48 ? h.toFixed(1) + "h" : Math.round(h / 24) + "d"; }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  function isMint(s) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s); }

  // ---------- data ----------
  function loadDex(mint) {
    return getJSON("https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(mint)).then(function (j) {
      var ps = (j && Array.isArray(j.pairs) ? j.pairs : []).filter(function (x) { return x && x.chainId === "solana"; });
      if (!ps.length) return null;
      ps.sort(function (a, b) { return ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0); });
      var p = ps[0], isBase = p.baseToken && p.baseToken.address === mint, tok = isBase ? p.baseToken : p.quoteToken;
      var tx = p.txns || {}, ch = p.priceChange || {}, info = p.info || {};
      return {
        sym: tok && tok.symbol || "coin", name: tok && tok.name || "", isBase: isBase,
        price: isBase ? parseFloat(p.priceUsd) : NaN,
        liq: p.liquidity ? p.liquidity.usd : null, mcap: p.marketCap != null ? p.marketCap : p.fdv,
        ageH: p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 36e5 : null,
        h1: ch.h1, h6: ch.h6, h24: ch.h24,
        b1: tx.h1 ? tx.h1.buys : null, s1: tx.h1 ? tx.h1.sells : null,
        b24: tx.h24 ? tx.h24.buys : null, s24: tx.h24 ? tx.h24.sells : null,
        dex: p.dexId, url: p.url, img: info.imageUrl || "",
        links: (info.websites || []).map(function (w) { return { t: w.label || "Website", u: w.url }; })
          .concat((info.socials || []).map(function (s) { return { t: s.type || "Social", u: s.url }; }))
      };
    });
  }

  function loadRug(mint) {
    var base = "https://api.rugcheck.xyz/v1/tokens/" + encodeURIComponent(mint) + "/report";
    return getJSON(base).then(function (d) {
      var known = d.knownAccounts || {};
      var skip = function (h) { var k = known[h.owner] || known[h.address]; return k && (k.type === "AMM" || k.type === "LOCKER"); };
      var holders = (d.topHolders || []).filter(function (h) { return !skip(h); });
      var top10 = holders.slice(0, 10).reduce(function (a, h) { return a + (h.pct || 0); }, 0);
      var maxW = holders.length ? Math.max.apply(null, holders.map(function (h) { return h.pct || 0; })) : null;
      var lp = null;
      (d.markets || []).forEach(function (m) { if (m.lp && m.lp.lpLockedPct != null) lp = Math.max(lp == null ? 0 : lp, m.lp.lpLockedPct); });
      return {
        full: true, mintOff: !d.mintAuthority, freezeOff: !d.freezeAuthority, lp: lp,
        top10: holders.length ? top10 : null, maxW: maxW, rugged: !!d.rugged,
        risks: (d.risks || []).map(function (r) { return { n: r.name, lvl: r.level, d: r.description }; }),
        holders: d.totalHolders
      };
    }).catch(function () {
      return getJSON(base + "/summary").then(function (s) {
        return { full: false, mintOff: null, freezeOff: null, lp: s.lpLockedPct != null ? s.lpLockedPct : null, top10: null, maxW: null, rugged: false,
          risks: (s.risks || []).map(function (r) { return { n: r.name, lvl: r.level, d: r.description }; }) };
      });
    }).catch(function () { return null; });
  }

  // ---------- analysis ----------
  function analyse(x, rc) {
    var checks = [], hard = [], soft = [];
    function chk(ok, label, note, isHard) {
      checks.push({ ok: ok, label: label, note: note });
      if (ok === false) (isHard ? hard : soft).push(label);
    }
    var lpPct = rc ? rc.lp : null;
    var danger = rc ? rc.risks.filter(function (r) { return r.lvl === "danger"; }) : [];
    if (rc) {
      if (rc.rugged) hard.push("Marked as rugged");
      chk(rc.mintOff, "Mint authority revoked", rc.mintOff == null ? "unknown" : rc.mintOff ? "can't print more" : "dev can print more", true);
      chk(rc.freezeOff, "Freeze authority revoked", rc.freezeOff == null ? "unknown" : rc.freezeOff ? "" : "dev can freeze wallets", true);
      chk(lpPct == null ? null : lpPct >= 90, "LP locked or burned ≥ 90%", lpPct == null ? "unknown" : lpPct.toFixed(0) + "%", lpPct != null && lpPct < 50);
      chk(rc.top10 == null ? null : rc.top10 < 30, "Top 10 wallets under 30%", rc.top10 == null ? "unknown" : rc.top10.toFixed(1) + "%", rc.top10 != null && rc.top10 > 50);
      chk(rc.maxW == null ? null : rc.maxW <= 5, "No wallet over 5%", rc.maxW == null ? "unknown" : "biggest " + rc.maxW.toFixed(1) + "%", rc.maxW != null && rc.maxW > 15);
      chk(danger.length === 0, "No danger warnings", danger.length ? danger.map(function (r) { return r.n; }).join(", ") : (rc.risks.length ? rc.risks.length + " minor" : "none"), true);
    } else {
      checks.push({ ok: null, label: "Safety check unavailable", note: "RugCheck didn't answer" });
    }
    chk(x.liq != null ? x.liq >= 30000 : null, "Liquidity ≥ $30K", kusd(x.liq), x.liq != null && x.liq < 10000);
    var bp = x.b1 != null && x.s1 != null && x.b1 + x.s1 > 0 ? x.b1 > x.s1 : (x.b24 != null && x.s24 != null ? x.b24 > x.s24 : null);
    chk(bp, "More buys than sells", x.b1 != null ? "1h " + x.b1 + " / " + x.s1 : "", false);
    chk(x.h1 == null ? null : x.h1 <= 50, "Not pumped 50%+ in 1h", pct(x.h1), false);
    chk(x.ageH == null ? null : x.ageH >= 2, "Older than 2 hours", age(x.ageH), false);

    var verdict, cls, why;
    if (hard.length) { verdict = "AVOID"; cls = "v-bad"; why = "Hard fail: " + hard.join(", ").toLowerCase() + ". Too easy to lose everything."; }
    else if (!rc) { verdict = "RISKY"; cls = "v-risk"; why = "Safety check unavailable, so Bull can't confirm it's safe. Trade small if at all."; }
    else if (!soft.length && checks.every(function (c) { return c.ok !== null; })) { verdict = "WORTH A LOOK"; cls = "v-good"; why = "Passes the safety checks with decent liquidity and buyers in control. Still a memecoin: use the stop."; }
    else { verdict = "RISKY"; cls = "v-risk"; why = "Mixed signals: " + (soft.length ? soft.join(", ").toLowerCase() : "some checks unknown") + ". Smaller size, respect the stop."; }

    // risk score -> same rules as the planner
    var risk = 0, L = x.liq || 0, M = x.mcap || 0, c1 = x.h1 || 0;
    if (L > 0 && L < 30000) risk += 2; else if (L > 0 && L < 75000) risk += 1;
    if (M > 0 && L > 0 && L / M < 0.1) risk += 1;
    if (x.ageH != null && x.ageH < 2) risk += 2; else if (x.ageH != null && x.ageH < 24) risk += 1;
    if (c1 > 150) risk += 2; else if (c1 > 50) risk += 1;
    if (x.b1 && x.s1 && x.b1 < x.s1) risk += 1;
    var t10 = rc && rc.top10 != null ? rc.top10 : 0;
    if (t10 > 30) risk += 2; else if (t10 > 20) risk += 1;
    if (lpPct == null) risk += 1; else if (lpPct < 90) risk += 3;

    var lv = null, p = x.price;
    if (verdict !== "AVOID" && p > 0) {
      var hot = c1 > 50;
      var e1 = hot ? p * 0.8 : p * 0.95, e2 = hot ? p * 0.65 : p * 0.85;
      e1 = Math.min(e1, p); e2 = Math.min(e2, e1); // entries never above the live price
      var avg = (e1 + e2) / 2;
      var sl = e2 * (risk >= 3 ? 0.85 : 0.8);
      if (sl < avg * 0.7) sl = avg * 0.7;
      if (sl > avg * 0.92) sl = avg * 0.92;
      var m = risk >= 3 ? [0.2, 0.45, 0.9] : risk >= 1 ? [0.3, 0.7, 1.5] : [0.4, 1.0, 2.5];
      lv = { price: p, e1: e1, e2: e2, avg: avg, sl: sl, m: m, hot: hot,
        tp: [avg * (1 + m[0]), avg * (1 + m[1]), avg * (1 + m[2])], sell: [50, 30, 20] };
    }
    return { verdict: verdict, cls: cls, why: why, checks: checks, hard: hard.concat(danger.map(function (r) { return r.d || r.n; })), lv: lv, risk: risk };
  }

  // ---------- render ----------
  function render(mint, x, rc, a) {
    var h = '<div class="res">';
    h += '<div class="verdict ' + a.cls + '"><div class="v">' + a.verdict + '</div><p>' + esc(a.why) + '</p></div>';
    h += '<div class="card"><div class="coin">' + (x.img ? '<img src="' + esc(x.img) + '" alt="">' : '') + '<div><b>' + esc(x.sym) + '</b><small>' + esc(x.name) + ' · ' + esc(x.dex || "") + '</small></div></div>';
    h += '<div class="stats">' + [["PRICE", fp(x.price)], ["LIQUIDITY", kusd(x.liq)], ["MARKET CAP", kusd(x.mcap)], ["AGE", age(x.ageH)], ["1H / 6H", pct(x.h1) + " / " + pct(x.h6)], ["24H", pct(x.h24)], ["BUYS 1H", x.b1 == null ? "—" : x.b1], ["SELLS 1H", x.s1 == null ? "—" : x.s1], ["HOLDERS", rc && rc.holders ? rc.holders.toLocaleString("en-US") : "—"]]
      .map(function (s) { return '<div><small>' + s[0] + '</small><b>' + esc(s[1]) + '</b></div>'; }).join("") + '</div>';
    if (x.links.length) h += '<div class="links">' + x.links.map(function (l) { return '<a href="' + esc(l.u) + '" target="_blank" rel="noopener">' + esc(l.t) + ' ↗</a>'; }).join("") + '</div>';
    h += '</div>';

    if (a.lv) {
      var L = a.lv, row = function (c, t, sub, v) { return '<div class="row" style="--c:' + c + '"><div><small>' + t + '</small><span>' + sub + '</span></div><b>' + v + '</b></div>'; };
      h += '<div class="lv"><h2>The plan</h2>';
      h += row(BLUE, "BUY ZONE", "Price now <strong>" + fp(L.price) + "</strong> · " + (L.hot ? "pumped hard: wait for a 20–35% dip" : "buy a 5–15% dip, split in two") + " (−" + Math.round((1 - L.e1 / L.price) * 100) + "% / −" + Math.round((1 - L.e2 / L.price) * 100) + "%)", fp(L.e1) + "<br>" + fp(L.e2));
      for (var i = 0; i < 3; i++) h += row(GREEN, "TAKE PROFIT " + (i + 1), "+" + Math.round(L.m[i] * 100) + "% · sell " + L.sell[i] + "%", fp(L.tp[i]));
      h += row(RED, "STOP-LOSS", "−" + Math.round((1 - L.sl / L.avg) * 100) + "% from your average · sell all", fp(L.sl));
      h += '<p class="hint">No swing high/low from the APIs, so levels use the % rules. Set TP and stop the moment you buy.</p></div>';
    } else if (a.verdict === "AVOID") {
      h += '<div class="dont"><h3>Don\'t buy</h3><ul>' + a.hard.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join("") + '</ul></div>';
    } else {
      h += '<div class="dont"><h3>No price</h3>DexScreener has no USD price for this token.</div>';
    }

    h += '<div class="card"><h2>Checks</h2><ul class="checks">' + a.checks.map(function (c) {
      return '<li><span>' + (c.ok === true ? "✅" : c.ok === false ? "❌" : "❔") + '</span>' + esc(c.label) + '<em>' + esc(c.note || "") + '</em></li>';
    }).join("") + '</ul></div>';
    h += '<div class="btns"><a class="fomo" href="https://fomo.family/tokens/solana/' + esc(mint) + '" target="_blank" rel="noopener">Open on FOMO ↗</a><a href="https://dexscreener.com/solana/' + esc(mint) + '" target="_blank" rel="noopener">DexScreener ↗</a></div>';
    h += '</div>';
    $("out").innerHTML = h;
  }


  // ---------- hero animation ----------
  var hero = $("hero"), statusEl = $("status"), RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stTimer = 0, typeTimer = 0, scanning = false;
  (function initFx() {
    var st = $("stars"), h = "";
    for (var i = 0; i < 16; i++) h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;--d:' + (5 + Math.random() * 6).toFixed(1) + 's;--w:' + (-Math.random() * 8).toFixed(1) + 's;--x:' + (Math.random() * 40 - 20).toFixed(0) + 'px"></i>';
    st.innerHTML = h;
    var g = hero.querySelector(".candles g"), c = "", y = 22;
    for (var k = 0; k < 40; k++) {
      var up = Math.random() > 0.42, b = 3 + Math.random() * 9, ny = Math.max(4, Math.min(34, y + (up ? -b : b) * 0.6));
      var top = Math.min(y, ny), hgt = Math.max(1.5, Math.abs(ny - y)), x = k * 5 + 1;
      c += '<line x1="' + (x + 1.5) + '" x2="' + (x + 1.5) + '" y1="' + (top - 2) + '" y2="' + (top + hgt + 2) + '" stroke="' + (up ? "#3DDC84" : "#ff6b6f") + '" stroke-width=".5"/>';
      c += '<rect x="' + x + '" y="' + top + '" width="3" height="' + hgt + '" fill="' + (up ? "#3DDC84" : "#ff6b6f") + '"/>';
      y = ny;
    }
    g.innerHTML = c;
  })();
  function setHero(state, text) { hero.setAttribute("data-state", state); if (text != null) statusEl.textContent = text; }
  function codeLines(mint) {
    var m = mint.slice(0, 6) + "…" + mint.slice(-4), L = ["> connect solana-mainnet", "> dexscreener.tokens(" + m + ")", "  pairs: scanning liquidity…", "> rugcheck.report(" + m + ")", "  mint_authority … ?", "  freeze_authority … ?", "  lp_locked … ?", "  top_holders[10] … ?", "> fib.levels(price)", "> risk.score()", "  buys/sells 1h …", "> plan.entries / tp / sl"];
    var h = L.map(function (l) { return "<div>" + esc(l) + "</div>"; }).join("");
    $("code").innerHTML = h + h;
  }
  function startScan(mint) {
    scanning = true; clearTimeout(typeTimer); codeLines(mint);
    var msgs = ["scanning…", "reading the pool…", "checking authorities…", "counting whales…", "measuring buy pressure…", "drawing your levels…"], i = 0;
    setHero("scan", msgs[0]); clearInterval(stTimer);
    stTimer = setInterval(function () { i = (i + 1) % msgs.length; statusEl.textContent = msgs[i]; }, 450);
  }
  function endScan(verdict) {
    scanning = false; clearInterval(stTimer);
    if (!verdict) { setHero("bad", "couldn't scan"); return; }
    var st = verdict === "WORTH A LOOK" ? "good" : verdict === "RISKY" ? "risk" : "bad";
    setHero(st, verdict === "WORTH A LOOK" ? "✦ worth a look ✦" : verdict === "RISKY" ? "risky · careful" : "avoid · don't buy");
    if (st === "good" && !RM) {
      var co = $("coins"), h = "";
      for (var i = 0; i < 12; i++) h += '<i style="left:' + (8 + Math.random() * 84).toFixed(0) + '%;animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's">' + (i % 3 ? "🪙" : "✨") + '</i>';
      co.innerHTML = h; setTimeout(function () { co.innerHTML = ""; }, 2600);
    }
  }
  $("mint").addEventListener("input", function () {
    if (scanning) return;
    setHero("typing", "reading address…"); clearTimeout(typeTimer);
    typeTimer = setTimeout(function () { if (!scanning) setHero("idle", isMint($("mint").value.trim()) ? "ready · tap Analyse" : "ready"); }, 900);
  });

  function run() {
    var mint = $("mint").value.trim().replace(/^.*\/(?=[1-9A-HJ-NP-Za-km-z]{32,44}$)/, "");
    var msg = $("msg"); msg.className = "msg";
    if (!isMint(mint)) { msg.textContent = "That doesn't look like a Solana token address."; msg.className = "msg err"; return; }
    $("mint").value = mint;
    $("go").disabled = true; $("go").textContent = "Analysing…"; msg.textContent = "Checking DexScreener and RugCheck…"; $("out").innerHTML = "";
    startScan(mint);
    var minWait = new Promise(function (ok) { setTimeout(ok, RM ? 0 : 1600); });
    Promise.all([loadDex(mint).catch(function (e) { return { err: e }; }), loadRug(mint), minWait]).then(function (res) {
      var x = res[0], rc = res[1];
      if (!x || x.err) { endScan(null); msg.textContent = x && x.err ? "Couldn't reach DexScreener (" + (x.err.message || "network") + "). Try again." : "No Solana trading pair found for this address."; msg.className = "msg err"; return; }
      msg.textContent = rc ? (rc.full ? "" : "Partial safety data (RugCheck summary only).") : "Safety check unavailable (RugCheck didn't answer).";
      var a = analyse(x, rc); render(mint, x, rc, a); endScan(a.verdict);
      try { localStorage.setItem("bull_last_mint", mint); } catch (e) {}
    }).catch(function (e) { endScan(null); msg.textContent = "Something went wrong: " + (e && e.message ? e.message : e); msg.className = "msg err"; }).then(function () { $("go").disabled = false; $("go").textContent = "Analyse"; });
  }

  $("go").addEventListener("click", run);
  $("mint").addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
  var q = new URLSearchParams(location.search).get("mint");
  if (q) { $("mint").value = q; run(); }
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
})();
