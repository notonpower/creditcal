/* 日本の祝日計算（1980〜2099に有効な近似式を使用） */
(function (global) {
  "use strict";

  function pad(n) { return String(n).padStart(2, "0"); }
  function key(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }

  // 第n月曜日（ハッピーマンデー用）
  function nthMonday(year, month, n) {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      const dt = new Date(year, month - 1, d);
      if (dt.getMonth() !== month - 1) break;
      if (dt.getDay() === 1) {
        count++;
        if (count === n) return d;
      }
    }
    return null;
  }

  // 春分・秋分（1980〜2099近似式）
  function springEquinox(year) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  function autumnEquinox(year) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }

  const cache = {};

  // 指定年の祝日マップ { "YYYY-MM-DD": "名称" } を返す
  function holidaysOfYear(year) {
    if (cache[year]) return cache[year];

    const map = {};
    const add = (m, d, name) => { map[key(year, m, d)] = name; };

    add(1, 1, "元日");
    add(1, nthMonday(year, 1, 2), "成人の日");
    add(2, 11, "建国記念の日");
    if (year >= 2020) add(2, 23, "天皇誕生日");
    add(3, springEquinox(year), "春分の日");
    add(4, 29, "昭和の日");
    add(5, 3, "憲法記念日");
    add(5, 4, "みどりの日");
    add(5, 5, "こどもの日");
    add(7, nthMonday(year, 7, 3), "海の日");
    add(8, 11, "山の日");
    add(9, nthMonday(year, 9, 3), "敬老の日");
    add(9, autumnEquinox(year), "秋分の日");
    add(10, nthMonday(year, 10, 2), "スポーツの日");
    add(11, 3, "文化の日");
    add(11, 23, "勤労感謝の日");

    // 国民の休日（祝日に挟まれた平日：主にシルバーウィーク）
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, m - 1, d);
        if (dt.getMonth() !== m - 1) break;
        const k = key(year, m, d);
        if (map[k]) continue;
        if (dt.getDay() === 0) continue; // 日曜は対象外
        const prev = new Date(year, m - 1, d - 1);
        const next = new Date(year, m - 1, d + 1);
        const pk = key(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
        const nk = key(next.getFullYear(), next.getMonth() + 1, next.getDate());
        if (map[pk] && map[nk]) map[k] = "国民の休日";
      }
    }

    // 振替休日（祝日が日曜の場合、次の平日かつ祝日でない日）
    const subs = {};
    Object.keys(map).forEach((k) => {
      const [yy, mm, dd] = k.split("-").map(Number);
      const dt = new Date(yy, mm - 1, dd);
      if (dt.getDay() === 0) {
        let nd = new Date(yy, mm - 1, dd + 1);
        while (true) {
          const nk = key(nd.getFullYear(), nd.getMonth() + 1, nd.getDate());
          if (!map[nk] && !subs[nk]) { subs[nk] = "振替休日"; break; }
          nd = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate() + 1);
        }
      }
    });
    Object.assign(map, subs);

    cache[year] = map;
    return map;
  }

  function holidayName(date) {
    const m = holidaysOfYear(date.getFullYear());
    return m[key(date.getFullYear(), date.getMonth() + 1, date.getDate())] || null;
  }

  function isHoliday(date) {
    return holidayName(date) !== null;
  }

  function isWeekend(date) {
    const g = date.getDay();
    return g === 0 || g === 6;
  }

  function isBusinessDay(date) {
    return !isWeekend(date) && !isHoliday(date);
  }

  global.JPHolidays = { holidayName, isHoliday, isWeekend, isBusinessDay };
})(window);
