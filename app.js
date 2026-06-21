"use strict";

/* ===== カード定義（発行会社別・引き落とし日） ===== */
const CARDS = [
  { id: "rakuten", name: "楽天カード",                 issuer: "楽天",       day: 27 },
  { id: "saison",  name: "セゾンカード",               issuer: "セゾン",     day: 4  },
  { id: "aeon",    name: "イオンカード",               issuer: "イオン",     day: 2  },
  { id: "kojima",  name: "コジマカード",               issuer: "イオン",     day: 2  },
  { id: "jcb",     name: "JCBカード",                  issuer: "JCB",        day: 10 },
  { id: "smbc_nl", name: "三井住友カード（NL）",       issuer: "三井住友",   day: 26 },
  { id: "olive",   name: "Olive",                      issuer: "三井住友",   day: 26 },
  { id: "amazon",  name: "Amazon Prime Mastercard",    issuer: "三井住友",   day: 26 },
  { id: "paypay",  name: "PayPayカード",               issuer: "PayPay",     day: 27 },
  { id: "mercard", name: "メルカード",                 issuer: "メルカリ",   day: 26 },
  { id: "epos",    name: "エポスカード",               issuer: "エポス",     day: 27 },
  { id: "view",    name: "ビューカード",               issuer: "ビュー",     day: 4  },
  { id: "dcard",   name: "dカード",                    issuer: "ドコモ",     day: 10 },
  { id: "ufj",     name: "UFJカード",                  issuer: "三菱UFJ",    day: 10 },
];

const STORAGE_KEY = "creditcal.state.v1";
const { isBusinessDay, isHoliday } = window.JPHolidays;
const $ = (id) => document.getElementById(id);

/* ===== 日付ユーティリティ ===== */
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function lastDayOfMonth(y, mi) { return new Date(y, mi + 1, 0).getDate(); }
function yen(n) { return "¥" + Math.round(n).toLocaleString("ja-JP"); }
function shiftForward(d) { let x = d; while (!isBusinessDay(x)) x = addDays(x, 1); return x; }
function shiftBackward(d) { let x = d; while (!isBusinessDay(x)) x = addDays(x, -1); return x; }

function nextDate(dayRule, base, shifter) {
  for (let off = 0; off < 3; off++) {
    const mi = base.getMonth() + off;
    const year = base.getFullYear() + Math.floor(mi / 12);
    const monthIndex = ((mi % 12) + 12) % 12;
    const dom = dayRule === "last" ? lastDayOfMonth(year, monthIndex) : dayRule;
    const nominal = new Date(year, monthIndex, Math.min(dom, lastDayOfMonth(year, monthIndex)));
    const actual = shifter(nominal);
    if (actual >= base) return actual;
  }
  return null;
}
const nextBillDate = (d, base) => nextDate(d, base, shiftForward);
const nextPayDate = (d, base) => nextDate(d, base, shiftBackward);

/* ===== 状態 ===== */
function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadState();
state.tutorHistory = state.tutorHistory || [];
state.cards = state.cards || {};
let lastSim = null;

/* ===== DOM 構築 ===== */
function buildPaydayOptions() {
  const sel = $("hamburgPayday");
  for (let d = 1; d <= 28; d++) {
    const o = document.createElement("option");
    o.value = String(d); o.textContent = d + "日"; sel.appendChild(o);
  }
  const last = document.createElement("option");
  last.value = "last"; last.textContent = "末日"; sel.appendChild(last);
}

function buildCardInputs() {
  const wrap = $("cardList");
  wrap.innerHTML = "";
  const groups = {};
  CARDS.forEach((c) => (groups[c.issuer] = groups[c.issuer] || []).push(c));

  Object.keys(groups).forEach((issuer) => {
    const cards = groups[issuer];
    const dayLabel = cards[0].day === "last" ? "末日" : cards[0].day + "日";
    const g = document.createElement("div");
    g.className = "cgroup";
    g.innerHTML = `<div class="cgroup-head"><b>${issuer}</b><span>毎月${dayLabel}引落</span></div>`;
    cards.forEach((c) => {
      const s = state.cards[c.id] || {};
      const row = document.createElement("div");
      row.className = "crow";
      row.innerHTML = `
        <div class="cname">${c.name}</div>
        <div class="cinputs">
          <label>請求額
            <div class="money"><em>¥</em><input type="number" inputmode="numeric" data-card="${c.id}" data-kind="bill" value="${s.bill ?? ""}" placeholder="0" /></div>
          </label>
          <label>うち交通費
            <div class="money"><em>¥</em><input type="number" inputmode="numeric" data-card="${c.id}" data-kind="transport" value="${s.transport ?? ""}" placeholder="0" /></div>
          </label>
        </div>`;
      g.appendChild(row);
    });
    wrap.appendChild(g);
  });
}

function renderTutorChips() {
  const box = $("tutorChips");
  box.innerHTML = "";
  state.tutorHistory.slice().sort((a, b) => b - a).forEach((v) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = yen(v);
    if (String(v) === $("tutor").value) b.classList.add("sel");
    b.addEventListener("click", () => {
      $("tutor").value = v;
      box.querySelectorAll(".chip").forEach((c) => c.classList.remove("sel"));
      b.classList.add("sel");
    });
    box.appendChild(b);
  });
}

function restoreInputs() {
  $("baseDate").value = state.baseDate || ymd(new Date());
  if (state.balance != null) $("balance").value = state.balance;
  $("hamburgPayday").value = state.hamburgPayday || "25";
  if (state.lastTutor != null) $("tutor").value = state.lastTutor;
  renderTutorChips();
}

/* ===== 入力収集・保存 ===== */
function collectInputs() {
  const num = (id) => { const v = parseFloat($(id).value); return isNaN(v) ? 0 : v; };
  const cards = {};
  document.querySelectorAll("[data-card]").forEach((inp) => {
    const id = inp.dataset.card, kind = inp.dataset.kind;
    const v = parseFloat(inp.value);
    cards[id] = cards[id] || { bill: 0, transport: 0 };
    cards[id][kind] = isNaN(v) ? 0 : v;
  });
  return {
    baseDate: $("baseDate").value || ymd(new Date()),
    balance: num("balance"), tutor: num("tutor"), hamburg: num("hamburg"),
    hamburgPayday: $("hamburgPayday").value, cards,
  };
}
function persist(input) {
  state.baseDate = input.baseDate;
  state.balance = input.balance;
  state.hamburgPayday = input.hamburgPayday;
  state.cards = input.cards;
  state.lastTutor = input.tutor;
  if (input.tutor > 0 && !state.tutorHistory.includes(input.tutor)) state.tutorHistory.push(input.tutor);
  saveState();
  renderTutorChips();
}

/* ===== シミュレーション ===== */
function simulate(input) {
  const base = startOfDay(parseYmd(input.baseDate));
  const events = [];
  CARDS.forEach((c) => {
    const bill = (input.cards[c.id] || {}).bill || 0;
    if (bill > 0) events.push({ date: nextBillDate(c.day, base), type: "out", amount: bill, label: c.name });
  });
  let lastBill = base;
  events.forEach((e) => { if (e.date > lastBill) lastBill = e.date; });

  if (input.hamburg > 0) {
    const d = nextPayDate(input.hamburgPayday, base);
    if (d) events.push({ date: d, type: "in", amount: input.hamburg, label: "ハンバーグ屋" });
  }
  if (input.tutor > 0) {
    const d = nextPayDate("last", base);
    if (d) events.push({ date: d, type: "in", amount: input.tutor, label: "家庭教師" });
  }

  events.sort((a, b) => (+a.date !== +b.date ? a.date - b.date : a.type === "out" ? -1 : 1));

  let balance = input.balance, minBalance = balance, shortfallDate = null, shortfallAmount = 0;
  events.forEach((e) => {
    balance += e.type === "out" ? -e.amount : e.amount;
    if (e.type === "out" && balance < 0 && shortfallDate === null) {
      shortfallDate = e.date; shortfallAmount = -balance;
    }
    if (balance < minBalance) minBalance = balance;
    e.balanceAfter = balance;
  });

  const totalBill = events.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
  const totalIn = events.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
  const totalTransport = CARDS.reduce((s, c) => s + ((input.cards[c.id] || {}).transport || 0), 0);
  return { base, events, finalBalance: balance, minBalance, shortfallDate, shortfallAmount,
    totalBill, totalIn, totalTransport, startBalance: input.balance, lastBill };
}

/* ===== 結果描画 ===== */
const WD = ["日", "月", "火", "水", "木", "金", "土"];
function fmtJp(d) { return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`; }

function renderResult(sim) {
  const v = $("verdict");
  if (sim.shortfallDate === null) {
    v.className = "verdict ok";
    v.innerHTML = `<span class="big">間に合います</span>
      すべての引き落とし時点で残高はプラスを維持できます。最終残高の見込みは <b>${yen(sim.finalBalance)}</b>、期間中の最低残高は ${yen(sim.minBalance)} です。`;
  } else {
    v.className = "verdict ng";
    v.innerHTML = `<span class="big">間に合いません</span>
      <b>${fmtJp(sim.shortfallDate)}</b> の引き落とし時点で <b>${yen(sim.shortfallAmount)}</b> 不足します。家庭教師は末日入金のため、それより前の請求は残高＋ハンバーグ屋給与で賄う必要があります。`;
  }

  const transport = sim.totalTransport > 0
    ? `<div class="srow accent"><span>うち交通費（経費計上用）</span><b>${yen(sim.totalTransport)}</b></div>` : "";
  const diff = sim.startBalance + sim.totalIn - sim.totalBill;
  $("summary").innerHTML = `
    <div class="srow"><span>開始残高</span><b>${yen(sim.startBalance)}</b></div>
    <div class="srow"><span>給与合計</span><b>${yen(sim.totalIn)}</b></div>
    <div class="srow"><span>請求合計</span><b>${yen(sim.totalBill)}</b></div>
    ${transport}
    <div class="srow total"><span>差引</span><b class="${diff < 0 ? "neg" : ""}">${yen(diff)}</b></div>
    <div class="srow"><span>期間中の最低残高</span><b class="${sim.minBalance < 0 ? "neg" : ""}">${yen(sim.minBalance)}</b></div>`;
}

/* ===== カレンダー ===== */
function renderCalendar(sim) {
  const wrap = $("calendar");
  wrap.innerHTML = "";
  closeSheet();

  const byDay = {};
  sim.events.forEach((e) => (byDay[ymd(e.date)] = byDay[ymd(e.date)] || []).push(e));

  let cur = new Date(sim.base.getFullYear(), sim.base.getMonth(), 1);
  const end = new Date(sim.lastBill.getFullYear(), sim.lastBill.getMonth(), 1);
  while (cur <= end) {
    wrap.appendChild(renderMonth(cur.getFullYear(), cur.getMonth(), byDay, sim.base));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
}

function renderMonth(year, mi, byDay, base) {
  const m = document.createElement("div");
  m.className = "month";
  m.innerHTML = `<div class="mhead">${year}年 ${mi + 1}月</div>`;

  const grid = document.createElement("div");
  grid.className = "grid";
  WD.forEach((w, i) => {
    const h = document.createElement("div");
    h.className = "gh" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
    h.textContent = w; grid.appendChild(h);
  });

  const firstDow = new Date(year, mi, 1).getDay();
  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement("div"); e.className = "cell empty"; grid.appendChild(e);
  }
  const days = lastDayOfMonth(year, mi);
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, mi, d);
    const cell = document.createElement("div");
    cell.className = "cell";
    const dow = date.getDay();
    if (dow === 0) cell.classList.add("sun");
    if (dow === 6) cell.classList.add("sat");
    if (isHoliday(date)) cell.classList.add("holiday");
    if (ymd(date) === ymd(base)) cell.classList.add("base");

    const evs = byDay[ymd(date)];
    let dots = "";
    if (evs) {
      cell.classList.add("has");
      const hasOut = evs.some((e) => e.type === "out");
      const hasIn = evs.some((e) => e.type === "in");
      dots = `<div class="dots">${hasOut ? '<i class="out"></i>' : ""}${hasIn ? '<i class="in"></i>' : ""}</div>`;
      if (evs[evs.length - 1].balanceAfter < 0) cell.classList.add("neg");
      cell.addEventListener("click", () => selectDay(cell, date, evs));
    } else {
      dots = `<div class="dots"></div>`;
    }
    cell.innerHTML = `<span class="cnum">${d}</span>${dots}`;
    grid.appendChild(cell);
  }
  m.appendChild(grid);
  return m;
}

function selectDay(cell, date, evs) {
  document.querySelectorAll(".cell.sel").forEach((c) => c.classList.remove("sel"));
  cell.classList.add("sel");
  const rows = evs.map((e) => {
    const cls = e.type === "out" ? "out" : "in";
    const sign = e.type === "out" ? "−" : "+";
    return `<div class="dd-row"><span>${e.label}</span><span class="amt ${cls}">${sign}${yen(e.amount)}</span></div>`;
  }).join("");
  const bal = evs[evs.length - 1].balanceAfter;
  $("sheetBody").innerHTML = `<h3>${fmtJp(date)}</h3>${rows}
    <div class="dd-bal"><span>引き落とし後の残高</span><span class="${bal < 0 ? "neg" : ""}">${yen(bal)}</span></div>`;
  openSheet();
}

function openSheet() {
  const bg = $("sheetBg"), sh = $("daySheet");
  bg.hidden = false; sh.hidden = false;
  requestAnimationFrame(() => { bg.classList.add("show"); sh.classList.add("show"); });
}
function closeSheet() {
  const bg = $("sheetBg"), sh = $("daySheet");
  bg.classList.remove("show"); sh.classList.remove("show");
  document.querySelectorAll(".cell.sel").forEach((c) => c.classList.remove("sel"));
  setTimeout(() => { bg.hidden = true; sh.hidden = true; }, 300);
}

/* ===== 画面遷移 ===== */
let current = 0;
const screens = () => Array.from(document.querySelectorAll(".screen"));
const stepBtns = () => Array.from(document.querySelectorAll(".steps .step"));

function goTo(idx) {
  if (idx === current) return;
  const dir = idx > current ? "in-right" : "in-left";
  if (idx === 3) {                       // 結果画面に入る時に計算
    const input = collectInputs();
    persist(input);
    lastSim = simulate(input);
    renderResult(lastSim);
    renderCalendar(lastSim);
  }
  screens().forEach((s, i) => {
    s.classList.toggle("active", i === idx);
    s.classList.remove("in-right", "in-left");
    if (i === idx) { void s.offsetWidth; s.classList.add(dir); }
  });
  stepBtns().forEach((b, i) => {
    b.classList.toggle("active", i === idx);
    b.classList.toggle("done", i < idx);
  });
  current = idx;
  document.querySelector(".stage").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ===== バインド ===== */
function bind() {
  document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => goTo(current + 1)));
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => goTo(current - 1)));
  $("calcBtn").addEventListener("click", () => goTo(3));
  stepBtns().forEach((b) => b.addEventListener("click", () => goTo(Number(b.dataset.go))));

  $("balance").addEventListener("change", () => { state.balance = parseFloat($("balance").value) || 0; saveState(); });
  $("baseDate").addEventListener("change", () => { state.baseDate = $("baseDate").value; saveState(); });
  $("hamburgPayday").addEventListener("change", () => { state.hamburgPayday = $("hamburgPayday").value; saveState(); });

  $("sheetClose").addEventListener("click", closeSheet);
  $("sheetBg").addEventListener("click", closeSheet);

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("請求額・給与の入力をクリアします（残高と履歴は残します）。")) return;
    document.querySelectorAll("[data-card]").forEach((i) => (i.value = ""));
    $("tutor").value = ""; $("hamburg").value = "";
    state.cards = {}; saveState();
    renderTutorChips();
    goTo(0);
  });
}

function init() {
  buildPaydayOptions();
  buildCardInputs();
  restoreInputs();
  bind();
  screens()[0].classList.add("active");
  stepBtns()[0].classList.add("active");
}
document.addEventListener("DOMContentLoaded", init);
