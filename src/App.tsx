import { Page, useGrokTheme, useState, useMemo, useEffect, ChangeEvent } from "./canvas";

type Pick = { time: string; sym: string; mint: string; price: number; mcap: number | null; liq: number | null; age_h?: number | null; h1?: number | null; buys?: number | null; sells?: number | null; top10?: number | null; lp_locked?: boolean | null; tp?: number | null; sl?: number | null };
type Tab = "home" | "picks" | "plan" | "trades";
type Trade = { id: number; sym: string; entry: number; size: number; exit: number | null; date: string };
const DATA: { updated: string; picks: Pick[] } = (window as any).__PICKS || { updated: "offline", picks: [] };
const IMG: { hero: string; stop: string; tp: string; scout: string } = { hero: "img/hero.jpg", stop: "img/stop.jpg", tp: "img/tp.jpg", scout: "img/scout.jpg" };

const CHAT_URL = "grokbot://app/v1/agent?id=a1decb0a-13b3-4449-a9af-72317bdd93c3";
const GREEN = "#1F9D63", GREEN_HERO = "#3DDC84", RED = "#E5484D", ORANGE = "#FF6A1A";
const INK = "#111111", MUTED = "#8B8B86", PAGE_BG = "#EFEEE9", PILL = "#F5F4F0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const KEY = "bull_planner_journal_v1";

function num(s: string): number { const v = parseFloat(s.replace(/[$,%\s]/g, "")); return isNaN(v) ? 0 : v; }
function fp(p: number): string {
  if (!(p > 0)) return "-";
  if (p >= 1) return "$" + p.toFixed(4);
  const d = Math.max(2, -Math.floor(Math.log10(p)) + 3);
  return "$" + p.toFixed(Math.min(d, 12));
}
function usd(v: number): string { return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function kusd(v: number | null | undefined): string { if (v == null) return "—"; return v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + (v / 1e3).toFixed(1) + "K"; }
function loadTrades(): Trade[] { try { const s = window.localStorage.getItem(KEY); return s ? (JSON.parse(s) as Trade[]) : []; } catch (e) { return []; } }

function Confetti(props: { party: number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!props.party) return;
    let id = 0;
    const loop = (now: number) => { const v = now / 1000; setT(v); if (v - props.party < 5) id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [props.party]);
  if (!props.party || t - props.party > 5) return null;
  const bits = Array.from({ length: 30 }, (_: unknown, i: number) => {
    const ph = (t - props.party) * 0.55 + (i % 7) * 0.05;
    return { x: (i * 37) % 300, y: -10 + ph * 300 + Math.sin(t * 5 + i) * 6, c: [GREEN_HERO, ORANGE, "#FFD34D", "#fff"][i % 4], r: (t * 200 + i * 40) % 360 };
  });
  return (
    <svg viewBox="0 0 300 300" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 3, pointerEvents: "none" }} aria-hidden="true">
      {bits.map((c, i: number) => <rect key={i} x={c.x} y={c.y} width={6} height={10} fill={c.c} transform={"rotate(" + c.r + " " + (c.x + 3) + " " + (c.y + 5) + ")"} />)}
    </svg>
  );
}

function Icon(props: { src: string; size?: number }) {
  const s = props.size || 44;
  return <img src={props.src} alt="" style={{ width: s + "px", height: s + "px", borderRadius: "12px", flex: "none", objectFit: "cover", background: "#000" }} />;
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; ph: string; wide?: boolean }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px", gridColumn: props.wide ? "1 / -1" : undefined, minWidth: 0 }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: MUTED, letterSpacing: "0.04em" }}>{props.label}</span>
      <input value={props.value} placeholder={props.ph} onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.value)} style={{ background: PILL, border: "1px solid #E2E1DB", borderRadius: "12px", padding: "10px 12px", fontFamily: MONO, fontSize: "13px", color: INK, outline: "none", minWidth: 0, width: "100%", boxSizing: "border-box" }} />
    </label>
  );
}

function Level(props: { name: string; price: string; action: string; why: string; color: string; rr?: string }) {
  return (
    <div style={{ background: PILL, borderRadius: "14px", padding: "10px 12px", borderLeft: "4px solid " + props.color }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "120px" }}>
          <div style={{ fontWeight: 800, fontSize: "13px", color: INK }}>{props.name}{props.rr ? <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 800, color: "#fff", background: INK, borderRadius: "6px", padding: "2px 6px" }}>{props.rr}</span> : null}</div>
          <div style={{ fontSize: "11px", color: MUTED }}>{props.action}</div>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: "14px", color: props.color }}>{props.price}</div>
      </div>
      <div style={{ fontSize: "11.5px", color: "#55554F", marginTop: "5px", lineHeight: "16px" }}>{props.why}</div>
    </div>
  );
}

export default function App() {
  const theme = useGrokTheme();
  const [ca, setCa] = useState(""); const [price, setPrice] = useState(""); const [liq, setLiq] = useState("");
  const [mcap, setMcap] = useState(""); const [ageH, setAgeH] = useState(""); const [ch1h, setCh1h] = useState("");
  const [buys, setBuys] = useState(""); const [sells, setSells] = useState(""); const [bank, setBank] = useState("500");
  const [hi, setHi] = useState(""); const [lo, setLo] = useState(""); const [top10, setTop10] = useState("");
  const [lp, setLp] = useState<"yes" | "no" | "?">("?");
  const [sym, setSym] = useState("");
  const [trades, setTrades] = useState<Trade[]>(loadTrades);
  const [saved, setSaved] = useState(true);
  const [jSym, setJSym] = useState(""); const [jEntry, setJEntry] = useState(""); const [jSize, setJSize] = useState("");
  const [exitDraft, setExitDraft] = useState<Record<number, string>>({});
  const [party, setParty] = useState(0);

  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify(trades)); setSaved(window.localStorage.getItem(KEY) !== null); } catch (e) { setSaved(false); }
  }, [trades]);

  const r = useMemo(() => {
    const p = num(price), L = num(liq), M = num(mcap), age = num(ageH), c1 = num(ch1h), b = num(buys), s = num(sells), bk = num(bank);
    const H = num(hi), Lw = num(lo), T10 = num(top10);
    if (p <= 0) return null;
    let risk = 0; const notes: string[] = [];
    if (L > 0 && L < 30000) { risk += 2; notes.push("Liquidity under $30K"); } else if (L > 0 && L < 75000) { risk += 1; notes.push("Modest liquidity"); }
    if (M > 0 && L > 0 && L / M < 0.1) { risk += 1; notes.push("Thin pool vs market cap"); }
    if (age > 0 && age < 2) { risk += 2; notes.push("Under 2h old"); } else if (age > 0 && age < 24) { risk += 1; notes.push("Under 24h old"); }
    if (c1 > 150) { risk += 2; notes.push("Up 150%+ in 1h, don't chase"); } else if (c1 > 50) { risk += 1; notes.push("Pumped 50%+ in 1h"); }
    if (b > 0 && s > 0 && b < s) { risk += 1; notes.push("More sells than buys"); }
    if (T10 > 30) { risk += 2; notes.push("Top 10 hold over 30%"); } else if (T10 > 20) { risk += 1; notes.push("Top 10 hold over 20%"); }
    if (lp === "no") { risk += 3; notes.push("LP NOT locked, rug risk"); } else if (lp === "?") { risk += 1; notes.push("LP lock not checked"); }
    const level = risk >= 6 ? "EXTREME" : risk >= 3 ? "HIGH" : risk >= 1 ? "MEDIUM" : "LOWER";
    const col = risk >= 3 ? RED : risk >= 1 ? ORANGE : GREEN;
    const swing = H > 0 && Lw > 0 && H > Lw && p >= Lw && p <= H * 1.05;
    let e1: number, e2: number, w1: string, w2: string;
    if (swing) {
      const mv = H - Lw, f50 = H - 0.5 * mv, f618 = H - 0.618 * mv;
      if (p > f50) { e1 = f50; e2 = f618; w1 = "Fib 0.5 of the move " + fp(Lw) + " → " + fp(H) + ": a normal pullback zone."; w2 = "Fib 0.618, the golden pocket: deeper pullback, best price."; }
      else if (p > f618) { e1 = p * 0.98; e2 = f618; w1 = "Already below Fib 0.5, so a small dip from here."; w2 = "Fib 0.618 golden pocket."; }
      else { e1 = p * 0.97; e2 = Math.max(Lw * 1.03, p * 0.9); w1 = "Price is under the golden pocket; only a small dip buy."; w2 = "Just above the swing low support " + fp(Lw) + "."; }
    } else {
      const hot = c1 > 50;
      e1 = hot ? p * 0.8 : p * 0.95; e2 = hot ? p * 0.65 : p * 0.85;
      w1 = hot ? "No swing data and it pumped 50%+: wait for a 20% dip." : "No swing data: a 5% dip under price.";
      w2 = hot ? "Deeper 35% dip, where pumps usually cool off." : "A 15% dip for a better average.";
    }
    const avg = (e1 + e2) / 2;
    let sl: number, ws: string;
    if (swing) { sl = Lw * 0.94; ws = "6% under the swing low " + fp(Lw) + ": if that breaks, the setup is dead."; }
    else { sl = e2 * (risk >= 3 ? 0.85 : 0.8); ws = (risk >= 3 ? "15%" : "20%") + " under Entry 2 (no swing low given)."; }
    if (sl < avg * 0.7) { sl = avg * 0.7; ws += " Capped at 30% below your average so one loss can't wreck you."; }
    if (sl > avg * 0.92) { sl = avg * 0.92; ws += " Pushed to 8% below average so normal wicks don't stop you out."; }
    const m = risk >= 3 ? [0.2, 0.45, 0.9] : risk >= 1 ? [0.3, 0.7, 1.5] : [0.4, 1.0, 2.5];
    let tp1 = avg * (1 + m[0]); let w_tp1 = "+" + Math.round(m[0] * 100) + "% on average: bank half early (" + (risk >= 3 ? "risky coin, take it fast" : "lock it in") + ").";
    if (swing && H * 0.97 > avg * 1.12 && H * 0.97 < tp1) { tp1 = H * 0.97; w_tp1 = "Just under the old high " + fp(H) + ", where sellers wait."; }
    const tp2 = avg * (1 + m[1]), tp3 = avg * (1 + m[2]);
    const dist = (avg - sl) / avg;
    const riskPct = risk >= 3 ? 0.01 : 0.02;
    const budget = bk * riskPct;
    let size = dist > 0 ? budget / dist : 0; const capNotes: string[] = [];
    const capB = bk * (risk >= 3 ? 0.05 : 0.1);
    if (size > capB) { size = capB; capNotes.push("capped at " + (risk >= 3 ? 5 : 10) + "% of bank"); }
    if (L > 0 && size > L * 0.01) { size = L * 0.01; capNotes.push("capped at 1% of liquidity"); }
    const rr = (tp: number) => ((tp - avg) / (avg - sl)).toFixed(1) + "R";
    return { risk, level, col, notes, e1, e2, w1, w2, sl, ws, avg, tp1, tp2, tp3, w_tp1, m, size, budget, riskPct, capNotes, maxLoss: size * dist, rr, swing, gauge: Math.min(100, (risk / 9) * 100) };
  }, [price, liq, mcap, ageH, ch1h, buys, sells, bank, hi, lo, top10, lp]);

  const st = useMemo(() => {
    const closed = trades.filter((x: Trade) => x.exit !== null);
    const pnl = (x: Trade) => x.exit === null ? 0 : x.size * (x.exit / x.entry - 1);
    const wins = closed.filter((x: Trade) => pnl(x) > 0).length;
    let eq = 0; const curve: number[] = [0];
    closed.forEach((x: Trade) => { eq += pnl(x); curve.push(eq); });
    return { closed: closed.length, open: trades.length - closed.length, wins, net: eq, curve, pnl, wr: closed.length ? Math.round((wins / closed.length) * 100) : 0 };
  }, [trades]);

  const mint = ca.trim(); const ok = mint.length > 30;
  const [dexBusy, setDexBusy] = useState(false); const [dexMsg, setDexMsg] = useState("");
  const loadDex = () => {
    if (!ok || dexBusy) return;
    setDexBusy(true); setDexMsg("Loading from DexScreener…");
    fetch("https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(mint))
      .then((res: Response) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then((j: any) => {
        const ps: any[] = (j && Array.isArray(j.pairs) ? j.pairs : []).filter((x: any) => x && x.chainId === "solana");
        if (!ps.length) { setDexMsg("No Solana pair found for this mint."); return; }
        ps.sort((a: any, b: any) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
        const p = ps[0];
        const isBase = p.baseToken && p.baseToken.address === mint;
        const tok = isBase ? p.baseToken : (p.quoteToken || p.baseToken);
        if (tok && tok.symbol) setSym(String(tok.symbol));
        if (p.priceUsd && isBase) setPrice(String(p.priceUsd));
        if (p.liquidity && p.liquidity.usd != null) setLiq(String(Math.round(p.liquidity.usd)));
        const mc = p.marketCap != null ? p.marketCap : p.fdv; if (mc != null) setMcap(String(Math.round(mc)));
        if (p.pairCreatedAt) setAgeH(String(Math.round((Date.now() - p.pairCreatedAt) / 36e5 * 10) / 10));
        if (p.priceChange && p.priceChange.h1 != null) setCh1h(String(p.priceChange.h1));
        if (p.txns && p.txns.h1) { setBuys(String(p.txns.h1.buys)); setSells(String(p.txns.h1.sells)); }
        const hh = p.high24h != null ? p.high24h : (p.priceHigh24h != null ? p.priceHigh24h : null);
        const ll = p.low24h != null ? p.low24h : (p.priceLow24h != null ? p.priceLow24h : null);
        if (hh != null) setHi(String(hh)); if (ll != null) setLo(String(ll));
        setDexMsg(isBase ? "Loaded " + (tok.symbol || "coin") + " · " + (p.dexId || "dex") + " pair, liquidity " + kusd(p.liquidity && p.liquidity.usd) + (hh == null ? " (no 24h high/low from Dex)" : "") : "Mint is the quote token of the top pair; price not filled.");
      })
      .catch((e: any) => setDexMsg("Couldn't load: " + (e && e.message ? e.message : "network error") + ". Check the mint or try again."))
      .then(() => setDexBusy(false));
  };
  const [tab, setTab] = useState<Tab>("home");
  const go = (id: string) => { setTab(id as Tab); try { window.scrollTo(0, 0); } catch (e) { } };
  const fill = (k: Pick) => {
    setCa(k.mint); setSym(k.sym); setPrice(String(k.price)); setLiq(k.liq != null ? String(k.liq) : ""); setMcap(k.mcap != null ? String(k.mcap) : "");
    setAgeH(k.age_h != null ? String(k.age_h) : ""); setCh1h(k.h1 != null ? String(k.h1) : ""); setBuys(k.buys != null ? String(k.buys) : ""); setSells(k.sells != null ? String(k.sells) : "");
    setTop10(k.top10 != null ? String(k.top10) : ""); setLp(k.lp_locked === true ? "yes" : k.lp_locked === false ? "no" : "?"); setHi(""); setLo("");
    go("plan");
  };
  const addTrade = (s: string, e: number, z: number) => {
    if (!(e > 0) || !(z > 0)) return;
    const d = new Date();
    setTrades([...trades, { id: Date.now(), sym: s || "coin", entry: e, size: z, exit: null, date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) }]);
  };
  const closeTrade = (id: number) => {
    const x = num(exitDraft[id] || ""); if (!(x > 0)) return;
    const t0 = trades.find((q: Trade) => q.id === id);
    setTrades(trades.map((q: Trade) => q.id === id ? { ...q, exit: x } : q));
    if (t0 && x > t0.entry) setParty(performance.now() / 1000);
  };

  const [more, setMore] = useState(false);
  const curve = st.curve; const cmin = Math.min(...curve), cmax = Math.max(...curve), cr = cmax - cmin || 1;
  const pts = curve.map((v: number, i: number) => (curve.length > 1 ? (i / (curve.length - 1)) * 300 : 0).toFixed(1) + "," + (70 - ((v - cmin) / cr) * 60).toFixed(1)).join(" ");
  const bk = num(bank) || 500; const goal = bk * 0.1; const gp = Math.max(0, Math.min(100, (st.net / goal) * 100));
  const openT = trades.filter((x: Trade) => x.exit === null);
  const mult = (bk + st.net) / bk;
  const tag = r ? r.level + " RISK" : sym ? sym.toUpperCase() + " · SOLANA" : "SOLANA · MEMECOINS";
  const tagBg = r ? (r.risk >= 3 ? RED : r.risk >= 1 ? ORANGE : GREEN) : ORANGE;
  const title = tab === "home" ? "Home" : tab === "picks" ? "Scanner picks" : tab === "plan" ? "Plan a trade" : "Trades";

  const Head = (p: { t: string; n: string }) => <div className="bp-head"><h2>{p.t}</h2><span>{p.n}</span></div>;
  const PickCard = (p: { k: Pick }) => (
    <div className="bp-card bp-tap" style={{ borderLeft: "4px solid " + ORANGE }} onClick={() => fill(p.k)}>
      <div className="bp-ch"><h2>{p.k.sym}</h2><span>sent {p.k.time}</span></div>
      <div className="bp-mono" style={{ marginTop: "6px" }}>{fp(p.k.price)} · MC {kusd(p.k.mcap)} · liq {kusd(p.k.liq)}</div>
      <div className="bp-mint">{p.k.mint}</div>
      <div className="bp-row">
        <button className="bp-btn on" onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); fill(p.k); }}>Plan it →</button>
        <a className="bp-link" href={"https://fomo.family/tokens/solana/" + p.k.mint} target="_blank" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>FOMO ↗</a>
        <a className="bp-link" href={"https://dexscreener.com/solana/" + p.k.mint} target="_blank" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>Dex ↗</a>
      </div>
    </div>
  );
  const TradeRow = (p: { x: Trade; full: boolean }) => {
    const x = p.x; const pl = st.pnl(x);
    return (
      <div className="bp-card" style={{ borderLeft: "4px solid " + (x.exit === null ? ORANGE : pl >= 0 ? GREEN : RED) }}>
        <div className="bp-ch"><h2 style={{ fontSize: "15px" }}>{x.sym} <span style={{ fontWeight: 600, color: MUTED, fontSize: "11px" }}>{x.date} · {x.exit === null ? "OPEN" : pl >= 0 ? "WIN" : "LOSS"}</span></h2>
          <b className="bp-mono" style={{ fontWeight: 800, color: x.exit === null ? INK : pl >= 0 ? GREEN : RED }}>{x.exit === null ? usd(x.size) : usd(pl) + " (" + ((x.exit / x.entry - 1) * 100).toFixed(0) + "%)"}</b></div>
        <div className="bp-mono" style={{ fontSize: "11px", marginTop: "3px" }}>in {fp(x.entry)}{x.exit !== null ? " → out " + fp(x.exit) : ""} · {usd(x.size)}</div>
        {p.full ? (
          <div className="bp-row">
            {x.exit === null ? (<>
              <input className="bp-in" style={{ width: "130px" }} value={exitDraft[x.id] || ""} placeholder="exit price" onChange={(e: ChangeEvent<HTMLInputElement>) => setExitDraft({ ...exitDraft, [x.id]: e.target.value })} />
              <button className="bp-btn on" onClick={() => closeTrade(x.id)}>Close</button>
            </>) : null}
            <button className="bp-btn" onClick={() => setTrades(trades.filter((q: Trade) => q.id !== x.id))}>Delete</button>
          </div>
        ) : null}
      </div>
    );
  };

  const CSS = `
.bp{font-family:Outfit,${theme.font.family};color:${INK};background:${PAGE_BG};border-radius:26px;min-height:100vh;-webkit-font-smoothing:antialiased}
.bp *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.bp-top{position:sticky;top:0;z-index:30;background:rgba(239,238,233,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:10px 14px 8px;border-radius:26px 26px 0 0;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.bp-top b{font-size:17px;font-weight:800;letter-spacing:-.02em}.bp-top span{font-size:12px;color:#6f6e68}
.bp-scr{display:flex;flex-direction:column;gap:12px;padding:4px 10px 104px;animation:bpIn .28s ease both}
@keyframes bpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.bp-hero{position:relative;overflow:hidden;border-radius:22px;min-height:308px;color:#fff;background:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px) 0 0/22px 22px,radial-gradient(ellipse 78% 86% at 8% 72%,#7a3a12 0%,#3a1c0c 36%,#120a06 62%,#000 78%),#000}
.bp-hero img.m{position:absolute;left:-6%;bottom:0;width:58%;max-width:300px;z-index:1;pointer-events:none}
.bp-copy{position:relative;z-index:2;margin-left:44%;padding:16px 14px 16px 4px}
.bp-copy h1{margin:0;font-size:24px;line-height:28px;font-weight:800;letter-spacing:-.02em}
.bp-live{display:inline-flex;align-items:center;gap:5px;margin-top:4px;font-size:11px;font-weight:800;letter-spacing:.04em;color:${GREEN_HERO}}
.bp-live i{width:8px;height:8px;border-radius:99px;background:${GREEN_HERO};box-shadow:0 0 8px ${GREEN_HERO};animation:bpP 1.8s ease-in-out infinite}
@keyframes bpP{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
.bp-tag{display:inline-block;margin-top:8px;color:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:6px}
.bp-kick{margin:16px 0 0;font-size:11px;letter-spacing:.08em;color:#b5b5b5;font-weight:650}
.bp-big{margin:0;font-size:clamp(32px,10vw,48px);line-height:1.02;font-weight:800;letter-spacing:-.03em}
.bp-meta{margin:4px 0 0;font-family:${MONO};font-size:12px;color:#b5b5b5}
.bp-mult{background:#fff;color:#111;font-family:${MONO};font-weight:800;font-size:13px;padding:3px 10px;border-radius:999px}
.bp-goal{margin:12px 0 0;text-align:right;font-size:11px;color:#b5b5b5;font-weight:650}
.bp-track{margin-top:3px;height:5px;border-radius:999px;background:#2B2B2B;overflow:hidden}.bp-track span{display:block;height:100%;background:${ORANGE};border-radius:999px;transition:width .4s}
.bp-head{display:flex;justify-content:space-between;align-items:baseline;margin:4px 4px 0}.bp-head h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}.bp-head span{font-size:12px;color:#6f6e68}
.bp-card{background:#fff;border-radius:20px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.bp-ch{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.bp-ch h2{margin:0;font-size:16px;font-weight:800;letter-spacing:-.01em}.bp-ch span{font-size:12px;color:#6f6e68}
.bp-ico{display:flex;align-items:center;gap:10px}
.bp-sub{font-size:12px;color:#6f6e68;margin-top:2px;line-height:1.4}
.bp-mono{font-family:${MONO};font-size:12px;color:#55554F}
.bp-mint{font-family:${MONO};font-size:10.5px;color:#8B8B86;margin-top:2px;word-break:break-all}
.bp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}
.bp-btn{background:${PILL};color:${INK};border:1px solid #E2E1DB;border-radius:999px;padding:9px 15px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;transition:transform .12s,filter .12s}
.bp-btn.on{background:${ORANGE};color:#fff;border-color:${ORANGE}}
.bp-btn:active,.bp-link:active,.bp-tap:active,.bp-dock button:active,.bp-dock a:active{transform:scale(.95);filter:brightness(.94)}
.bp-tap{cursor:pointer;transition:transform .12s}
.bp-link{background:${PILL};color:${INK};text-decoration:none;font-weight:700;font-size:12px;padding:9px 13px;border-radius:999px;border:1px solid #E2E1DB;transition:transform .12s}
.bp-in{background:${PILL};border:1px solid #E2E1DB;border-radius:12px;padding:10px 12px;font-family:${MONO};font-size:13px;color:${INK};outline:none;min-width:0;width:100%}
.bp-in:focus{border-color:${ORANGE}}
.bp-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.bp-tile{background:#fff;border-radius:14px;padding:10px 8px 10px 12px;min-width:0}
.bp-tile small{font-size:10px;font-weight:800;color:#6f6e68;letter-spacing:.06em}.bp-tile b{display:block;font-family:${MONO};font-size:15px;font-weight:800;margin-top:6px;word-break:break-all}
.bp-empty{background:#fff;border-radius:20px;padding:22px 16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}.bp-empty strong{display:block;font-size:16px}.bp-empty p{margin:4px 0 0;color:#6f6e68;font-size:13px;line-height:1.45}
.bp-dockw{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;justify-content:center;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)}
.bp-dock{pointer-events:auto;width:min(464px,calc(100% - 16px));margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:2px;background:#fff;border:1px solid #DDDCD6;border-radius:999px;padding:6px;box-shadow:0 6px 24px rgba(0,0,0,.22)}
.bp-dock button{background:transparent;border:0;color:#55554F;font-size:12px;font-weight:700;padding:10px 11px;border-radius:999px;cursor:pointer;font-family:inherit;transition:background .2s,color .2s,transform .12s}
.bp-dock button.on{color:#111;background:#F3F2ED;box-shadow:inset 0 -2px 0 ${ORANGE}}
.bp-dock a{background:${ORANGE};color:#fff;font-weight:800;font-size:14px;padding:10px 20px;border-radius:999px;text-decoration:none;transition:transform .12s}
@media (max-width:360px){.bp-copy h1{font-size:20px;line-height:24px}.bp-copy{margin-left:38%}.bp-dock button{font-size:11px;padding:10px 7px}.bp-dock a{padding:10px 13px;font-size:13px}}
@media (prefers-reduced-motion:reduce){.bp-scr,.bp-live i{animation:none}}
`;

  return (
    <Page title="Memecoin Entry & Exit Planner" summary="Bull Planner app: scanner picks, smart entries and exits, and a trade journal." width="column">
      <style>{CSS}</style>
      <div className="bp">
        <div className="bp-top"><b>{title}</b><span>Last updated {DATA.updated} · Athens</span></div>

        {tab === "home" ? (
          <div className="bp-scr" key="home">
            <div className="bp-hero">
              <img className="m" src={IMG.hero} alt="Bull mascot" style={{ filter: "drop-shadow(0 0 22px " + (st.net < 0 ? "rgba(255,90,95,.5)" : "rgba(255,106,26,.45)") + ")" }} />
              <Confetti party={party} />
              <div className="bp-copy">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}><h1>Bull Planner</h1><span className="bp-live"><i />LIVE</span></div>
                <span className="bp-tag" style={{ background: tagBg }}>{tag}</span>
                <p className="bp-kick">NET P&amp;L</p>
                <p className="bp-big" style={{ color: st.net < 0 ? "#FF5A5F" : GREEN_HERO }}>{(st.net >= 0 ? "+" : "") + usd(st.net)}</p>
                <p className="bp-meta">{st.closed} closed · {st.open} open · bank {usd(bk)}</p>
                <div className="bp-row" style={{ marginTop: "12px" }}><span className="bp-mult">{mult.toFixed(2)}x</span><span style={{ fontSize: "13px", color: "#C9C9C9" }}>{st.closed ? st.wr + "% wins" : "no closed trades"}</span></div>
                <p className="bp-goal">goal +{usd(goal)}</p>
                <div className="bp-track"><span style={{ width: gp + "%" }} /></div>
              </div>
            </div>
            <Head t="Latest pick" n={DATA.picks.length + " from scanner"} />
            {DATA.picks.length ? PickCard({ k: DATA.picks[0] }) : <div className="bp-empty"><strong>No picks yet</strong><p>The scanner adds coins here.</p></div>}
            <Head t="Open trades" n={openT.length + " open"} />
            {openT.length ? openT.slice(-3).reverse().map((x: Trade) => <div key={x.id} className="bp-tap" onClick={() => go("trades")}>{TradeRow({ x: x, full: false })}</div>)
              : <div className="bp-empty"><strong>Nothing open</strong><p>Plan a coin and tap “Log this trade”.</p></div>}
          </div>
        ) : null}

        {tab === "picks" ? (
          <div className="bp-scr" key="picks">
            <div className="bp-card bp-ico"><Icon src={IMG.scout} /><div><b style={{ fontSize: "15px" }}>Bull's scout</b><div className="bp-sub">Numbers as of when the scanner sent them. Tap a coin to plan it.</div></div></div>
            <Head t="Coins" n={DATA.picks.length + " picks"} />
            {DATA.picks.map((k: Pick, i: number) => <div key={i}>{PickCard({ k: k })}</div>)}
          </div>
        ) : null}

        {tab === "plan" ? (
          <div className="bp-scr" key="plan">
            <div className="bp-card">
              <div className="bp-ch"><h2>{sym ? sym : "Your coin"}</h2><span>{r ? r.level.toLowerCase() + " risk" : "paste or pick"}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "10px" }}>
                <Field label="CONTRACT ADDRESS" value={ca} onChange={setCa} ph="Paste the Solana mint address" wide />
                <Field label="PRICE (USD)" value={price} onChange={setPrice} ph="0.0001783" />
                <Field label="YOUR BANK (USD)" value={bank} onChange={setBank} ph="500" />
              </div>
              <div className="bp-row" style={{ alignItems: "center" }}>
                <button className="bp-btn on" disabled={!ok || dexBusy} style={{ opacity: !ok || dexBusy ? 0.5 : 1 }} onClick={loadDex}>{dexBusy ? "Loading…" : "Load from DexScreener"}</button>
                {dexMsg ? <span className="bp-sub">{dexMsg}</span> : null}
              </div>
              {ok ? (
                <div className="bp-row">
                  <a className="bp-link" href={"https://dexscreener.com/solana/" + mint} target="_blank">Dex ↗</a>
                  <a className="bp-link" href={"https://rugcheck.xyz/tokens/" + mint} target="_blank">RugCheck ↗</a>
                  <a className="bp-link" style={{ background: ORANGE, color: "#fff", border: "none" }} href={"https://fomo.family/tokens/solana/" + mint} target="_blank">Trade on FOMO ↗</a>
                </div>
              ) : null}
            </div>
            {r ? (<>
              <div className="bp-tiles">
                {[["BUY AT", fp(r.e1), "#3B6FF0"], ["TAKE PROFIT", fp(r.tp1), GREEN], ["STOP", fp(r.sl), RED]].map((x: string[], i: number) => (
                  <div key={i} className="bp-tile" style={{ boxShadow: "inset 4px 0 0 " + x[2] + ", 0 1px 2px rgba(0,0,0,.06)" }}><small>{x[0]}</small><b style={{ color: x[2] }}>{x[1]}</b></div>
                ))}
              </div>
              <div className="bp-card">
                <div className="bp-ch"><h2>Size {usd(r.size)}</h2><span>max loss {usd(r.maxLoss)}</span></div>
                <div className="bp-row"><button className="bp-btn on" onClick={() => { addTrade(sym, r.avg, Math.round(r.size * 100) / 100); go("trades"); }}>Log this trade</button></div>
              </div>
              {r.notes.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{r.notes.map((n: string, i: number) => <span key={i} style={{ background: "#FDECEC", color: RED, fontSize: "12px", fontWeight: 700, padding: "6px 10px", borderRadius: "999px" }}>{n}</span>)}</div> : null}
            </>) : <div className="bp-empty"><strong>Waiting for a price</strong><p>Pick a coin from Picks or paste a price above.</p></div>}

            <button className="bp-btn" style={{ width: "100%", padding: "13px" }} onClick={() => setMore(!more)}>{more ? "Hide details ▴" : "More details (smarter plan) ▾"}</button>
            {more ? (
              <div className="bp-card">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                  <Field label="TICKER" value={sym} onChange={setSym} ph="PEPE" />
                  <Field label="LIQUIDITY (USD)" value={liq} onChange={setLiq} ph="39400" />
                  <Field label="MARKET CAP (USD)" value={mcap} onChange={setMcap} ph="178400" />
                  <Field label="AGE (HOURS)" value={ageH} onChange={setAgeH} ph="0.7" />
                  <Field label="1H CHANGE (%)" value={ch1h} onChange={setCh1h} ph="45" />
                  <Field label="TOP 10 HOLD (%)" value={top10} onChange={setTop10} ph="22" />
                  <Field label="BUYS (1H)" value={buys} onChange={setBuys} ph="537" />
                  <Field label="SELLS (1H)" value={sells} onChange={setSells} ph="351" />
                  <Field label="SWING HIGH / 24H HIGH" value={hi} onChange={setHi} ph="0.00021" />
                  <Field label="SWING LOW / 24H LOW" value={lo} onChange={setLo} ph="0.00012" />
                </div>
                <div style={{ marginTop: "12px", fontSize: "11px", fontWeight: 700, color: MUTED, letterSpacing: "0.04em" }}>LP LOCKED OR BURNED? (RUGCHECK)</div>
                <div className="bp-row" style={{ marginTop: "6px" }}>
                  {(["yes", "no", "?"] as const).map((v) => <button key={v} className={"bp-btn" + (lp === v ? " on" : "")} onClick={() => setLp(v)}>{v === "yes" ? "Yes, locked" : v === "no" ? "Not locked" : "Don't know"}</button>)}
                </div>
              </div>
            ) : null}

            {r ? (<>
              <Head t="Entries" n="2 limit buys" />
              <div className="bp-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Level name="Entry 1" price={fp(r.e1)} action={"buy " + usd(r.size / 2)} why={r.w1} color="#3B6FF0" />
                <Level name="Entry 2" price={fp(r.e2)} action={"buy " + usd(r.size / 2)} why={r.w2} color="#8B6CF0" />
              </div>
              <Head t="Take-profits" n={"avg " + fp(r.avg)} />
              <div className="bp-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div className="bp-ico"><Icon src={IMG.tp} /><div className="bp-sub">Set all three the moment you're in.</div></div>
                <Level name="Take-profit 1" price={fp(r.tp1)} rr={r.rr(r.tp1)} action={"sell 50% · +" + Math.round((r.tp1 / r.avg - 1) * 100) + "%, then stop to " + fp(r.avg)} why={r.w_tp1} color={GREEN} />
                <Level name="Take-profit 2" price={fp(r.tp2)} rr={r.rr(r.tp2)} action={"sell 30% · +" + Math.round((r.tp2 / r.avg - 1) * 100) + "%"} why="Second scale-out; most memecoin pumps fade before here." color={GREEN} />
                <Level name="Take-profit 3" price={fp(r.tp3)} rr={r.rr(r.tp3)} action={"sell the rest · +" + Math.round((r.tp3 / r.avg - 1) * 100) + "%"} why={"Runner target, scaled to risk (" + r.level.toLowerCase() + ")."} color={GREEN} />
              </div>
              <Head t="Stop-loss" n={"-" + Math.round((1 - r.sl / r.avg) * 100) + "%"} />
              <div className="bp-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div className="bp-ico"><Icon src={IMG.stop} /><div className="bp-sub">Your shield. Never move it down.</div></div>
                <Level name="Stop-loss" price={fp(r.sl)} action={"sell 100% · -" + Math.round((1 - r.sl / r.avg) * 100) + "% from average"} why={r.ws} color={RED} />
              </div>
              <Head t="Position size" n={r.riskPct * 100 + "% risk"} />
              <div className="bp-card">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                  {[["Size", usd(r.size)], ["Max loss at stop", usd(r.maxLoss)], ["Risk budget", usd(r.budget)], ["Stop distance", Math.round((1 - r.sl / r.avg) * 100) + "%"]].map((x: string[], i: number) => (
                    <div key={i} style={{ background: PILL, borderRadius: "14px", padding: "10px 12px" }}><div style={{ fontSize: "11px", color: MUTED, fontWeight: 700 }}>{x[0]}</div><div style={{ fontFamily: MONO, fontWeight: 800, fontSize: "15px", marginTop: "2px" }}>{x[1]}</div></div>
                  ))}
                </div>
                <div className="bp-sub" style={{ marginTop: "8px" }}>Size = bank × risk% ÷ stop distance{r.capNotes.length ? "; " + r.capNotes.join(", ") : ""}.</div>
              </div>
            </>) : null}
            <Head t="Rules" n="5 that never change" />
            <div className="bp-card" style={{ display: "flex", flexDirection: "column", gap: "7px", alignItems: "flex-start" }}>
              {["Check RugCheck first: liquidity locked, no wallet over 5%.", "Never chase a pump. Wait for your entry or walk away.", "Exits before entries. Never move the stop down.", "Only take trades where TP1 is at least 1R.", "1 to 2% risk per coin."].map((x: string, i: number) => (
                <div key={i} style={{ display: "inline-flex", gap: "9px", background: "#E9E8E3", borderRadius: "16px", padding: "8px 12px 8px 10px" }}><span style={{ width: "3px", alignSelf: "stretch", borderRadius: "2px", background: ORANGE, flex: "none" }} /><span style={{ fontSize: "13px", lineHeight: "18px" }}>{x}</span></div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "trades" ? (
          <div className="bp-scr" key="trades">
            <div className="bp-tiles">
              {[["NET P&L", usd(st.net), st.net >= 0 ? GREEN : RED], ["WIN RATE", st.closed ? st.wr + "%" : "—", INK], ["TRADES", st.closed + " / " + st.open, INK]].map((x: string[], i: number) => (
                <div key={i} className="bp-tile" style={{ boxShadow: "inset 4px 0 0 " + (x[2] === INK ? ORANGE : x[2]) + ", 0 1px 2px rgba(0,0,0,.06)" }}><small>{x[0]}</small><b style={{ color: x[2] }}>{x[1]}</b></div>
              ))}
            </div>
            <div className="bp-card">
              <div className="bp-ch"><h2>Equity</h2><span style={{ color: saved ? GREEN : RED, fontWeight: 700 }}>{saved ? "● saved on this device" : "● not saved, copy backup"}</span></div>
              {curve.length > 2 ? (
                <svg viewBox="0 0 300 80" width="100%" style={{ marginTop: "8px", display: "block" }} aria-label="equity line">
                  <line x1={0} x2={300} y1={70 - ((0 - cmin) / cr) * 60} y2={70 - ((0 - cmin) / cr) * 60} stroke="#DDDCD6" strokeDasharray="4 4" />
                  <polyline points={pts} fill="none" stroke={st.net >= 0 ? GREEN : RED} strokeWidth={2.5} strokeLinejoin="round" />
                </svg>
              ) : <div className="bp-sub">Close 2+ trades to see your equity line.</div>}
            </div>
            <Head t="Add trade" n="manual" />
            <div className="bp-card">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                <Field label="TICKER" value={jSym} onChange={setJSym} ph="TGC" />
                <Field label="ENTRY $" value={jEntry} onChange={setJEntry} ph="0.00015" />
                <Field label="SIZE $" value={jSize} onChange={setJSize} ph="10" />
              </div>
              <div className="bp-row"><button className="bp-btn on" onClick={() => { addTrade(jSym, num(jEntry), num(jSize)); setJSym(""); setJEntry(""); setJSize(""); }}>Add trade</button></div>
            </div>
            <Head t="Journal" n={trades.length + " trades"} />
            {trades.length ? [...trades].reverse().map((x: Trade) => <div key={x.id}>{TradeRow({ x: x, full: true })}</div>) : <div className="bp-empty"><strong>No trades yet</strong><p>Log one from Plan or add it above.</p></div>}
            <div className="bp-card">
              <div style={{ fontSize: "11px", fontWeight: 700, color: MUTED }}>BACKUP (copy; paste back to restore)</div>
              {trades.length ? <textarea className="bp-in" readOnly value={JSON.stringify(trades)} style={{ height: "54px", marginTop: "6px", fontSize: "10px" }} /> : null}
              <input className="bp-in" style={{ marginTop: "6px", fontSize: "11px" }} placeholder="paste a backup here to restore" onChange={(e: ChangeEvent<HTMLInputElement>) => { try { const v = JSON.parse(e.target.value) as Trade[]; if (Array.isArray(v)) setTrades(v); } catch (err) { } }} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="bp-dockw">
        <nav className="bp-dock">
          <button className={tab === "home" ? "on" : ""} onClick={() => go("home")}>Home</button>
          <button className={tab === "picks" ? "on" : ""} onClick={() => go("picks")}>Picks</button>
          <a href={CHAT_URL}>Chat</a>
          <button className={tab === "plan" ? "on" : ""} onClick={() => go("plan")}>Plan</button>
          <button className={tab === "trades" ? "on" : ""} onClick={() => go("trades")}>Trades</button>
        </nav>
      </div>
    </Page>
  );
}
