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

/* ===== 日付ユーティリティ ===== */
const { isBusinessDay } = window.JPHolidays;

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

// 引き落とし：土日祝なら「翌営業日」
function shiftForward(date) {
  let d = date;
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}
// 給与：土日祝なら「前営業日」
function shiftBackward(date) {
  let d = date;
  while (!isBusinessDay(d)) d = addDays(d, -1);
  return d;
}

// 指定の「日（1〜31 or 'last'）」について、基準日以降で最初に来る引き落とし日（翌営業日繰り）
function nextBillDate(dayRule, base) {
  for (let offset = 0; offset < 3; offset++) {
    const y = base.getFullYear();
    const mi = base.getMonth() + offset;
    const year = y + Math.floor(mi / 12);
    const monthIndex = ((mi % 12) + 12) % 12;
    const dom = dayRule === "last" ? lastDayOfMonth(year, monthIndex) : dayRule;
    const nominal = new Date(year, monthIndex, Math.min(dom, lastDayOfMonth(year, monthIndex)));
    const actual = shiftForward(nominal);
    if (actual >= base) return actual;
  }
  return null;
}

// 給与：基準日以降で最初に来る入金日（前営業日繰り）
function nextPayDate(dayRule, base) {
  for (let offset = 0; offset < 3; offset++) {
    const y = base.getFullYear();
    const mi = base.getMonth() + offset;
    const year = y + Math.floor(mi / 12);
    const monthIndex = ((mi % 12) + 12) % 12;
    const dom = dayRule === "last" ? lastDayOfMonth(year, monthIndex) : dayRule;
    const nominal = new Date(year, monthIndex, Math.min(dom, lastDayOfMonth(year, monthIndex)));
    const actual = shiftBackward(nominal);
    if (actual >= base) return actual;
  }
  return null;
}

/* ===== 状態管理（localStorage） ===== */
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
state.tutorHistory = state.tutorHistory || [];
state.cards = state.cards || {};

/* ===== DOM 構築 ===== */
const $ = (id) => document.getElementById(id);

function buildPaydayOptions() {
  const sel = $("hamburgPayday");
  for (let d = 1; d <= 28; d++) {
    const o = document.createElement("option");
    o.value = String(d);
    o.textContent = d + "日";
    sel.appendChild(o);
  }
  const last = document.createElement("option");
  last.value = "last";
  last.textContent = "末日";
  sel.appendChild(last);
}

function buildCardInputs() {
  const wrap = $("cardList");
  wrap.innerHTML = "";

  // 発行会社ごとにグループ化
  const groups = {};
  CARDS.forEach((c) => {
    (groups[c.issuer] = groups[c.issuer] || []).push(c);
  });

  Object.keys(groups).forEach((issuer) => {
    const g = document.createElement("div");
    g.className = "card-group";
    const cards = groups[issuer];
    const dayLabel = cards[0].day === "last" ? "末日" : cards[0].day + "日";
    g.innerHTML = `<div class="group-head">${issuer} <span class="day-tag">引落: 毎月${dayLabel}</span></div>`;

    cards.forEach((c) => {
      const saved = state.cards[c.id] || {};
      const row = document.createElement("div");
      row.className = "card-row";
      row.innerHTML = `
        <div class="card-name">${c.name}</div>
        <label class="field">
          <span>請求額</span>
          <input type="number" inputmode="numeric" data-card="${c.id}" data-kind="bill"
                 value="${saved.bill != null ? saved.bill : ""}" placeholder="0" />
        </label>
        <label class="field">
          <span>うち交通費</span>
          <input type="number" inputmode="numeric" data-card="${c.id}" data-kind="transport"
                 value="${saved.transport != null ? saved.transport : ""}" placeholder="0" />
        </label>
      `;
      g.appendChild(row);
    });
    wrap.appendChild(g);
  });
}

function refreshTutorHistory() {
  const sel = $("tutorHistory");
  sel.innerHTML = '<option value="">履歴…</option>';
  state.tutorHistory
    .slice()
    .sort((a, b) => b - a)
    .forEach((v) => {
      const o = document.createElement("option");
      o.value = String(v);
      o.textContent = yen(v);
      sel.appendChild(o);
    });
}

function restoreInputs() {
  $("baseDate").value = state.baseDate || ymd(new Date());
  if (state.balance != null) $("balance").value = state.balance;
  $("hamburgPayday").value = state.hamburgPayday || "25";
  $("tutorPayday").value = "last";
  if (state.lastTutor != null) $("tutor").value = state.lastTutor;
  refreshTutorHistory();
}

/* ===== 入力収集 ===== */
function collectInputs() {
  const num = (id) => {
    const v = parseFloat($(id).value);
    return isNaN(v) ? 0 : v;
  };
  const cards = {};
  document.querySelectorAll("[data-card]").forEach((inp) => {
    const id = inp.dataset.card;
    const kind = inp.dataset.kind;
    const v = parseFloat(inp.value);
    cards[id] = cards[id] || { bill: 0, transport: 0 };
    cards[id][kind] = isNaN(v) ? 0 : v;
  });
  return {
    baseDate: $("baseDate").value || ymd(new Date()),
    balance: num("balance"),
    tutor: num("tutor"),
    hamburg: num("hamburg"),
    hamburgPayday: $("hamburgPayday").value,
    cards,
  };
}

function persist(input) {
  state.baseDate = input.baseDate;
  state.balance = input.balance;
  state.hamburgPayday = input.hamburgPayday;
  state.cards = input.cards;
  state.lastTutor = input.tutor;
  if (input.tutor > 0 && !state.tutorHistory.includes(input.tutor)) {
    state.tutorHistory.push(input.tutor);
  }
  saveState(state);
  refreshTutorHistory();
}

/* ===== シミュレーション ===== */
function simulate(input) {
  const base = startOfDay(parseYmd(input.baseDate));
  const events = [];

  // 請求イベント
  CARDS.forEach((c) => {
    const ci = input.cards[c.id] || {};
    const bill = ci.bill || 0;
    if (bill > 0) {
      const date = nextBillDate(c.day, base);
      events.push({ date, type: "out", amount: bill, label: c.name });
    }
  });

  // 最終支払日（シミュレーション範囲）
  let lastBill = base;
  events.forEach((e) => { if (e.date > lastBill) lastBill = e.date; });

  // 給与イベント（今サイクルで効く分を1回ずつ）
  if (input.hamburg > 0) {
    const d = nextPayDate(input.hamburgPayday, base);
    if (d && d <= addDays(lastBill, 0)) events.push({ date: d, type: "in", amount: input.hamburg, label: "ハンバーグ屋" });
    else if (d) events.push({ date: d, type: "in", amount: input.hamburg, label: "ハンバーグ屋", late: true });
  }
  if (input.tutor > 0) {
    const d = nextPayDate("last", base);
    if (d) events.push({ date: d, type: "in", amount: input.tutor, label: "家庭教師" });
  }

  // 日付順 → 同日は入金を先に処理（保守的に：実際は引落が先のことも。安全側に倒すため out を先にする）
  events.sort((a, b) => {
    if (+a.date !== +b.date) return a.date - b.date;
    // 同日は引き落としを先に（残高不足を厳しめに検知）
    return a.type === "out" ? -1 : 1;
  });

  let balance = input.balance;
  let minBalance = balance;
  let shortfallDate = null;
  let shortfallAmount = 0;

  events.forEach((e) => {
    if (e.type === "out") {
      balance -= e.amount;
      if (balance < 0 && shortfallDate === null) {
        shortfallDate = e.date;
        shortfallAmount = -balance;
      }
      if (balance < minBalance) minBalance = balance;
    } else {
      balance += e.amount;
    }
    e.balanceAfter = balance;
  });

  const totalBill = events.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
  const totalIn = events.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
  const totalTransport = CARDS.reduce((s, c) => s + ((input.cards[c.id] || {}).transport || 0), 0);

  return {
    base, events, finalBalance: balance, minBalance,
    shortfallDate, shortfallAmount,
    totalBill, totalIn, totalTransport,
    startBalance: input.balance, lastBill,
  };
}

/* ===== 結果描画 ===== */
function renderResult(sim) {
  const verdict = $("verdict");
  const ok = sim.shortfallDate === null;

  if (ok) {
    verdict.className = "verdict ok";
    verdict.innerHTML = `✅ <strong>間に合います。</strong> すべての引き落とし時点で残高はプラスを維持できます。<br>
      最終残高見込み: <strong>${yen(sim.finalBalance)}</strong> ／ 期間中の最低残高: ${yen(sim.minBalance)}`;
  } else {
    verdict.className = "verdict ng";
    verdict.innerHTML = `⚠️ <strong>間に合いません。</strong>
      <strong>${formatJp(sim.shortfallDate)}</strong> の引き落とし時点で
      <strong>${yen(sim.shortfallAmount)}</strong> 不足します。<br>
      家庭教師の給与は末日入金のため、月末より前（26日・27日など）の請求はハンバーグ屋給与＋残高で賄う必要があります。
      不足分を事前に入金するか、支払いの組み替えを検討してください。`;
  }

  const transportNote = sim.totalTransport > 0
    ? `<div class="sum-row highlight"><span>うち交通費（経費計上用・Suica等）</span><b>${yen(sim.totalTransport)}</b></div>`
    : "";

  $("summary").innerHTML = `
    <div class="sum-row"><span>開始残高</span><b>${yen(sim.startBalance)}</b></div>
    <div class="sum-row"><span>給与合計（今サイクル）</span><b>${yen(sim.totalIn)}</b></div>
    <div class="sum-row"><span>請求合計</span><b>${yen(sim.totalBill)}</b></div>
    ${transportNote}
    <div class="sum-row total"><span>差引（開始残高＋給与−請求）</span><b>${yen(sim.startBalance + sim.totalIn - sim.totalBill)}</b></div>
    <div class="sum-row"><span>期間中の最低残高</span><b class="${sim.minBalance < 0 ? "neg" : ""}">${yen(sim.minBalance)}</b></div>
  `;

  $("resultCard").hidden = false;
}

function formatJp(date) {
  const w = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}月${date.getDate()}日(${w})`;
}

/* ===== カレンダー描画 ===== */
function renderCalendar(sim) {
  const wrap = $("calendar");
  wrap.innerHTML = "";

  // イベントを日付キーでまとめる
  const byDay = {};
  sim.events.forEach((e) => {
    const k = ymd(e.date);
    (byDay[k] = byDay[k] || []).push(e);
  });

  // 表示範囲：基準日の月 〜 最終支払日の月
  const start = new Date(sim.base.getFullYear(), sim.base.getMonth(), 1);
  const end = new Date(sim.lastBill.getFullYear(), sim.lastBill.getMonth(), 1);

  let cursor = start;
  while (cursor <= end) {
    wrap.appendChild(renderMonth(cursor.getFullYear(), cursor.getMonth(), byDay, sim.base));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
}

function renderMonth(year, monthIndex, byDay, base) {
  const div = document.createElement("div");
  div.className = "month";
  div.innerHTML = `<h3>${year}年 ${monthIndex + 1}月</h3>`;

  const table = document.createElement("table");
  const head = document.createElement("tr");
  ["日", "月", "火", "水", "木", "金", "土"].forEach((w, i) => {
    const th = document.createElement("th");
    th.textContent = w;
    if (i === 0) th.className = "sun";
    if (i === 6) th.className = "sat";
    head.appendChild(th);
  });
  table.appendChild(head);

  const firstDow = new Date(year, monthIndex, 1).getDay();
  const days = lastDayOfMonth(year, monthIndex);

  let row = document.createElement("tr");
  for (let i = 0; i < firstDow; i++) row.appendChild(document.createElement("td"));

  for (let d = 1; d <= days; d++) {
    if (row.children.length === 7) {
      table.appendChild(row);
      row = document.createElement("tr");
    }
    const date = new Date(year, monthIndex, d);
    const td = document.createElement("td");
    td.className = "day";
    const dow = date.getDay();
    if (dow === 0) td.classList.add("sun");
    if (dow === 6) td.classList.add("sat");
    if (window.JPHolidays.isHoliday(date)) td.classList.add("holiday");
    if (ymd(date) === ymd(base)) td.classList.add("today");

    let inner = `<div class="dnum">${d}</div>`;
    const evs = byDay[ymd(date)];
    if (evs) {
      evs.forEach((e) => {
        const cls = e.type === "in" ? "ev in" : "ev out";
        const sign = e.type === "in" ? "+" : "−";
        inner += `<div class="${cls}">${sign}${yen(e.amount).replace("¥", "")}<small>${e.label}</small></div>`;
      });
      const last = evs[evs.length - 1];
      const balCls = last.balanceAfter < 0 ? "bal neg" : "bal";
      inner += `<div class="${balCls}">残 ${yen(last.balanceAfter)}</div>`;
      if (last.balanceAfter < 0) td.classList.add("warn");
    }
    td.innerHTML = inner;
    row.appendChild(td);
  }
  while (row.children.length < 7) row.appendChild(document.createElement("td"));
  table.appendChild(row);

  div.appendChild(table);
  return div;
}

/* ===== イベント ===== */
function onCalculate() {
  const input = collectInputs();
  persist(input);
  const sim = simulate(input);
  renderResult(sim);
  renderCalendar(sim);
  $("calendarCard").hidden = false;
  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function onReset() {
  if (!confirm("入力中の請求額・給与をクリアします（残高・履歴は保持）。よろしいですか？")) return;
  document.querySelectorAll("[data-card]").forEach((i) => (i.value = ""));
  $("tutor").value = "";
  $("hamburg").value = "";
  state.cards = {};
  saveState(state);
  $("resultCard").hidden = true;
  $("calendarCard").hidden = true;
}

/* ===== 自動保存（残高・基準日） ===== */
function bindAutosave() {
  $("balance").addEventListener("change", () => {
    state.balance = parseFloat($("balance").value) || 0;
    saveState(state);
  });
  $("baseDate").addEventListener("change", () => {
    state.baseDate = $("baseDate").value;
    saveState(state);
  });
  $("hamburgPayday").addEventListener("change", () => {
    state.hamburgPayday = $("hamburgPayday").value;
    saveState(state);
  });
  $("tutorHistory").addEventListener("change", (e) => {
    if (e.target.value) $("tutor").value = e.target.value;
  });
}

/* ===== 初期化 ===== */
function init() {
  buildPaydayOptions();
  buildCardInputs();
  restoreInputs();
  bindAutosave();
  $("calcBtn").addEventListener("click", onCalculate);
  $("resetBtn").addEventListener("click", onReset);
}

document.addEventListener("DOMContentLoaded", init);
