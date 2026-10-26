// 予算の計算と画面の更新
(function () {
  var D = window.TRIP, FROM = D.FROM, TO = D.TO, TIPS = D.TIPS, HUBS = D.HUBS || [];
  var AFF = window.TRIP_AFFILIATES || [];
  var SC = window.TRIP_SCENES;
  var ENTRY = window.TRIP_ENTRY || { checked: "", rules: {}, pending: {} };

  var TYPE = { lcc: "LCC", fsc: "直行便", via: "乗継便" };
  var AIR_HINT = {
    lcc: "運賃に受託手荷物・座席指定・機内食は含まれません。必要なものを下で選んでください。",
    fsc: "受託手荷物・機内食・座席指定は運賃に含まれます。",
    via: "経由地で乗り換えるため所要時間は長めです。手荷物と機内食は多くの場合運賃に含まれます。"
  };
  // LCCのオプション料金（1人往復）[近距離, 長距離]
  var LCC_OPTS = [
    { id: "bag", n: "受託手荷物（20kg）", p: [6000, 11000] },
    { id: "seat", n: "座席指定", p: [2000, 5000] },
    { id: "meal", n: "機内食", p: [2000, 4000] }
  ];
  var PE_MULT = 1.8;
  // 経由地：乗り継ぎでよく使う都市（選択肢の上にまとめる）と、空港から出なくても渡航認証が必要な国
  var HUB_POPULAR = ["doha", "dubai", "istanbul", "helsinki", "frankfurt", "amsterdam", "london", "paris", "seoul", "taipei", "hongkong",
    "beijing", "shanghai", "singapore", "bangkok", "kualalumpur", "hanoi", "hcm", "la", "sanfrancisco", "vancouver", "honolulu"];
  var TRANSIT_FEE = { honolulu: 1, newyork: 1, la: 1, sanfrancisco: 1, lasvegas: 1, vancouver: 1 };
  var MODE = {
    student: { name: "大学生の節約旅", i: 0, hint: "LCCや乗継便、ドミトリー（相部屋）、ローカル食堂、ISIC国際学生証などの学割を前提にした予算です。" },
    standard: { name: "標準", i: 1, hint: "直行便のエコノミー、3つ星クラスのホテル（2名1室）、レストランも適度に使う予算です。" }
  };

  var $ = function (id) { return document.getElementById(id); };
  var yen = function (n) { return "¥" + Math.round(n).toLocaleString("ja-JP"); };
  var man = function (n) {
    var v = n / 10000;
    return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("ja-JP");
  };
  var round = function (n, step) { return Math.round(n / step) * step; };
  var DAY = 86400000;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function parseDate(s) {
    if (!s) return null;
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function fmtDate(d) {
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd;
  }
  function ymd(d) { return fmtDate(d).slice(2).replace(/-/g, ""); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  var WD = ["日", "月", "火", "水", "木", "金", "土"];
  function md(d) { return (d.getMonth() + 1) + "/" + d.getDate() + "（" + WD[d.getDay()] + "）"; }
  function findTo(id) { return TO.find(function (x) { return x.id === id; }); }
  function findFrom(id) { return FROM.find(function (x) { return x.id === id; }); }

  // 日付からシーズンを判定（航空券・宿泊の倍率）
  function seasonOf(d) {
    var x = (d.getMonth() + 1) * 100 + d.getDate();
    if (x >= 1226 || x <= 104) return { n: "年末年始", fl: 1.7, ht: 1.35 };
    if (x >= 427 && x <= 506) return { n: "ゴールデンウィーク", fl: 1.6, ht: 1.3 };
    if (x >= 808 && x <= 818) return { n: "お盆", fl: 1.6, ht: 1.3 };
    if (x >= 720 && x <= 831) return { n: "夏休み", fl: 1.25, ht: 1.15 };
    if (x >= 210 && x <= 331) return { n: "春休み（卒業旅行シーズン）", fl: 1.15, ht: 1.05 };
    if ((x >= 108 && x <= 209) || (x >= 601 && x <= 710) || (x >= 1124 && x <= 1219)) return { n: "閑散期", fl: 0.85, ht: 0.9 };
    return { n: "通常期", fl: 1, ht: 1 };
  }

  function defaultAirline(t, mode) {
    var pick = 0, best = mode === "student" ? Infinity : -Infinity;
    t.air.forEach(function (a, i) {
      if (mode === "student" ? a.m < best : (a.t !== "lcc" && a.m <= 1 && a.m > best)) { best = a.m; pick = i; }
    });
    return pick;
  }
  function defaultLccOpts(t, mode) {
    var long = !!t.long;
    return { bag: mode === "standard" || long, seat: false, meal: mode === "standard" && long };
  }

  // 見積もりの計算。dep が null のときは「通常期・平日出発」の目安として計算する
  function estimate(p) {
    var f = p.f, t = p.t, modeKey = p.mode, s = MODE[modeKey].i;
    var a = t.air[p.ai], people = p.people, long = t.long ? 1 : 0, days = p.days;
    var factors = [];
    var se = { n: "通常期", fl: 1, ht: 1 }, wk = 1, lf = 1;
    factors.push({ n: a.n.replace(/（.*?）/g, "") + "（" + TYPE[a.t] + "）", v: "×" + a.m, dir: a.m < 1 ? "down" : "" });
    if (p.dep) {
      se = seasonOf(p.dep);
      if (p.ret) { var se2 = seasonOf(p.ret); if (se2.fl > se.fl) se = se2; }
      factors.push({ n: "時期：" + se.n, v: "×" + se.fl, dir: se.fl > 1 ? "up" : se.fl < 1 ? "down" : "" });
      if (p.dep.getDay() === 5 || p.dep.getDay() === 6) { wk = 1.08; factors.push({ n: "金・土曜出発", v: "×1.08", dir: "up" }); }
      var lead = Math.round((p.dep - today()) / DAY);
      if (lead >= 0 && lead < 14) { lf = 1.3; factors.push({ n: "出発まで2週間未満", v: "×1.3", dir: "up" }); }
      else if (lead >= 14 && lead < 30) { lf = 1.15; factors.push({ n: "出発まで1か月未満", v: "×1.15", dir: "up" }); }
      else if (lead >= 45 && lead <= 150) { lf = 0.95; factors.push({ n: "45日以上前の予約", v: "×0.95", dir: "down" }); }
    }
    // 経由地を指定したのに直行便を選んでいる場合は、いちばん安い乗継便の料金で計算する
    var a2 = a, viaMult = 1;
    if (p.stop && a.t !== "via" && !p.override) {
      var vias = t.air.filter(function (x) { return x.t === "via"; });
      if (vias.length) {
        a2 = vias.reduce(function (best, x) { return x.m < best.m ? x : best; });
        factors[0] = { n: "経由地あり：" + a2.n.replace(/（.*?）/g, "") + "（乗継便）", v: "×" + a2.m, dir: a2.m < 1 ? "down" : "" };
      } else {
        viaMult = 1.08;
        factors.push({ n: "経由便の加算", v: "×1.08", dir: "up" });
      }
    }
    var pe = a2.t !== "lcc" && p.opts.pe;
    if (pe) factors.push({ n: "プレミアムエコノミー", v: "×" + PE_MULT, dir: "up" });

    var add = f.add[long], fare1;
    if (p.override > 0) {
      fare1 = p.override;
      factors = [{ n: "Skyscannerなどで見た料金を使用", v: yen(p.override), dir: "" }];
    } else {
      fare1 = round(t.base * a2.m * se.fl * wk * lf * viaMult * (pe ? PE_MULT : 1) + add, 1000);
      if (add) factors.push({ n: f.name + "発の加算", v: "+" + yen(add), dir: "up" });
    }
    var opt1 = 0, optNames = [];
    if (a2.t === "lcc") LCC_OPTS.forEach(function (o) { if (p.opts[o.id]) { opt1 += o.p[long]; optNames.push(o.n.replace(/（.*?）/, "")); } });
    // 経由地に泊まる（途中降機）場合は、周遊の航空券になるぶんを上乗せ
    var stopPrem = 0;
    if (p.stop && p.stop.unit === "d") {
      stopPrem = Math.max(5000, round(fare1 * 0.05, 1000));
      factors.push({ n: "途中降機（立ち寄り）の追加料金", v: "+" + yen(stopPrem), dir: "up" });
    }
    var flight1 = fare1 + opt1 + stopPrem;

    var stopN = p.stop && p.stop.unit === "d" ? p.stop.len : 0;
    var nights = days - 1 - (t.night || 0) - stopN, localDays = nights + 1, rooms = Math.ceil(people / 2);
    var hotel, hotelCalc;
    if (modeKey === "student") {
      var bed = round(Math.max(1500, t.ht[0] * 0.35) * se.ht, 100);
      hotel = bed * nights * people;
      hotelCalc = "ドミトリー1ベッド " + yen(bed) + " × " + nights + "泊 × " + people + "名";
    } else {
      var room = round(t.ht[1] * se.ht, 500);
      hotel = room * nights * rooms;
      hotelCalc = "ホテル1室 " + yen(room) + " × " + nights + "泊 × " + rooms + "室";
    }
    var food1 = modeKey === "student" ? round(t.fd[0] * 0.85, 100) : t.fd[1];
    var tr1 = t.tr[s];
    var ac1 = modeKey === "student" ? round(t.ac[0] * 0.8, 100) : t.ac[1];
    var insurance1 = round((long ? 1500 : 1000) + (long ? 700 : 350) * days, 100);
    var data1 = (modeKey === "student" ? (long ? 500 : 350) : (long ? 700 : 500)) * days;
    var misc1 = round((modeKey === "student" ? 4000 : 12000) * (long ? 1.3 : 1), 1000);
    var en = entryFor(t.id, fmtDate(p.dep || today()));
    var fee1 = en.expired || !en.rule ? 0 : en.rule.fee || 0;

    // 経由地での滞在費
    var stopItem = null, hen = null;
    if (p.stop) {
      var sx = p.stop, hb = sx.hub, parts = [], pp = 0, hotelS = 0, hotelDesc = "";
      hen = entryFor(hb.id, fmtDate(p.dep || today()));
      var hFood = modeKey === "student" ? round(hb.fd[0] * 0.85, 100) : hb.fd[1];
      var hAc = modeKey === "student" ? round(hb.ac[0] * 0.8, 100) : hb.ac[1];
      var hubHotel = function (n) {
        if (modeKey === "student") {
          var b = round(Math.max(1500, hb.ht[0] * 0.35) * se.ht, 100);
          hotelDesc = "ドミトリー " + yen(b) + " × " + n + "泊 × " + people + "名";
          return b * n * people;
        }
        var rm = round(hb.ht[1] * se.ht, 500);
        hotelDesc = "ホテル1室 " + yen(rm) + " × " + n + "泊 × " + rooms + "室";
        return rm * n * rooms;
      };
      if (sx.unit === "h") {
        var meals = Math.max(1, Math.ceil(sx.len / 6)), meal = round(hFood / 3 * 1.4, 100);
        pp += meals * meal; parts.push("空港での食事 " + yen(meal) + "×" + meals + "回");
        if (sx.goOut) { var go = hb.tr[s] + round(hAc * 0.5, 100); pp += go; parts.push("市内への往復と観光 " + yen(go)); }
        if (sx.len >= 10) hotelS = hubHotel(1);
      } else {
        var day1 = hFood + hb.tr[s] + hAc;
        pp += day1 * sx.len; parts.push("食費・交通・観光 " + yen(day1) + "×" + sx.len + "日");
        hotelS = hubHotel(sx.len);
      }
      var hr = hen.rule;
      var needEntry = sx.unit === "d" || sx.goOut || TRANSIT_FEE[hb.id];
      if (needEntry && hr && !hen.expired && hr.fee && !(fee1 && en.rule && hr.feeName === en.rule.feeName)) {
        pp += hr.fee; parts.push(hr.feeName + " " + yen(hr.fee));
      }
      stopItem = { k: "経由地での滞在", c: "--s7", v: pp * people + hotelS,
        calc: hb.name + "：" + parts.join("・") + "（1人）" + (hotelS ? " ＋ " + hotelDesc : "") };
    }

    var items = [
      { k: "航空券", c: "--s1", v: flight1 * people,
        calc: "運賃 " + yen(fare1) + (opt1 ? " ＋ " + optNames.join("・") + " " + yen(opt1) : "") +
          (stopPrem ? " ＋ 途中降機 " + yen(stopPrem) : "") + " × " + people + "名（往復）" },
      { k: "宿泊", c: "--s2", v: hotel, calc: hotelCalc },
      { k: "食費", c: "--s3", v: food1 * localDays * people, calc: yen(food1) + " × " + localDays + "日 × " + people + "名" },
      { k: "現地交通", c: "--s4", v: tr1 * localDays * people, calc: yen(tr1) + " × " + localDays + "日 × " + people + "名（空港アクセス含む）" },
      { k: "観光・体験", c: "--s5", v: ac1 * localDays * people,
        calc: yen(ac1) + " × " + localDays + "日 × " + people + "名" + (modeKey === "student" ? "（学割込み）" : "") },
      { k: "保険・通信・雑費", c: "--s6", v: (insurance1 + data1 + misc1 + fee1) * people,
        calc: "保険 " + yen(insurance1) + "・eSIM " + yen(data1) + "・お土産等 " + yen(misc1) + (fee1 ? "・" + en.rule.feeName + " " + yen(fee1) : "") + "（1人）" }
    ];
    if (stopItem) items.push(stopItem);
    var total = items.reduce(function (x, y) { return x + y.v; }, 0);
    return { items: items, total: total, flight1: flight1, factors: factors, se: se, nights: nights, a: a2, entry: en,
      hubEntry: hen, viaSwitched: a2 !== a };
  }

  // ===== 入国情報：旅行日に有効なルールを選ぶ =====
  function jaDate(s) { var p = s.split("-"); return +p[0] + "年" + +p[1] + "月" + +p[2] + "日"; }
  function entryFor(id, day) {
    var list = ENTRY.rules[id] || [], cur = null, idx = -1, expired = null;
    list.forEach(function (r, i) {
      if ((!r.from || r.from <= day) && (!r.until || day <= r.until)) { cur = r; idx = i; }
    });
    if (!cur) list.forEach(function (r) { if (r.until && r.until < day) expired = r; });
    return {
      rule: cur || expired,
      expired: !cur && !!expired,
      prev: idx > 0 ? list[idx - 1] : null,
      next: list.filter(function (r) { return r.from && r.from > day; })[0] || null
    };
  }
  function entryCard(t, dep) {
    var en = entryFor(t.id, fmtDate(dep)), r = en.rule;
    if (!r) return "";
    var meta = [];
    if (r.from && !en.expired) meta.push("施行日 " + jaDate(r.from));
    if (r.until) meta.push("期限 " + jaDate(r.until) + "の入国まで");
    if (ENTRY.checked) meta.push("情報の確認日 " + jaDate(ENTRY.checked));
    var h = '<div class="tipc entry' + (en.expired ? " warn" : "") + '"><span class="t">入国（' + md(dep) + " 出発の場合）</span>";
    h += en.expired
      ? '<p class="entry-warn">' + esc(r.after || "この日程は措置の期限を過ぎています。最新の情報を確認してください。") + "</p>"
      : "<p>" + esc(r.text) + "</p>";
    h += '<div class="entry-meta">' + meta.map(function (m) { return '<span class="chip">' + esc(m) + "</span>"; }).join("") + "</div>";
    if (en.prev && !en.expired && en.prev.until) h += '<p class="entry-sub"><b>' + jaDate(en.prev.until) + "の入国までのルール：</b>" + esc(en.prev.text) + "</p>";
    if (en.next) h += '<p class="entry-sub"><b>' + jaDate(en.next.from) + "から変更予定：</b>" + esc(en.next.text) + "</p>";
    var pend = ENTRY.pending && ENTRY.pending[t.id];
    if (pend) h += '<p class="entry-sub"><b>今後の予定：</b>' + esc(pend) + "</p>";
    if (r.src) h += '<p class="entry-sub">情報源：<a href="' + esc(r.src[1]) + '" target="_blank" rel="noopener">' + esc(r.src[0]) + "</a></p>";
    return h + "</div>";
  }

  // 行き先を探すページ（find.html）からも同じ計算を使えるように公開する
  window.TRIP_CALC = {
    estimate: estimate, MODE: MODE, TYPE: TYPE, defaultAirline: defaultAirline, defaultLccOpts: defaultLccOpts,
    findTo: findTo, findFrom: findFrom, yen: yen, man: man, DAY: DAY, entryFor: entryFor
  };
  if (!document.getElementById("form")) return; // 見積もりの入力欄がないページ（find.htmlなど）はここまで

  // ===== 初期化 =====
  var pageCity = document.body.getAttribute("data-city");
  FROM.forEach(function (f) {
    var o = document.createElement("option");
    o.value = f.id; o.textContent = f.name + "（" + f.code + " など）";
    if (f.id === "kanto") o.selected = true;
    $("from").appendChild(o);
  });
  var groups = {};
  TO.forEach(function (t) {
    if (!groups[t.g]) {
      groups[t.g] = document.createElement("optgroup");
      groups[t.g].label = t.g;
      $("to").appendChild(groups[t.g]);
    }
    var o = document.createElement("option");
    o.value = t.id; o.textContent = t.name;
    if (t.id === (pageCity || "taipei")) o.selected = true;
    groups[t.g].appendChild(o);
  });
  // 経由地の選択肢
  var HUB_ALL = TO.concat(HUBS);
  function findHub(id) { return HUB_ALL.find(function (x) { return x.id === id; }); }
  (function () {
    var sel = $("hub");
    sel.appendChild(new Option("なし（直行便・乗り継ぎを入れない）", ""));
    var g1 = document.createElement("optgroup"), g2 = document.createElement("optgroup");
    g1.label = "乗り継ぎでよく使う都市"; g2.label = "その他の都市";
    HUB_POPULAR.forEach(function (id) { var h = findHub(id); if (h) g1.appendChild(new Option(h.name + "（" + h.code + "）", h.id)); });
    TO.forEach(function (h) { if (HUB_POPULAR.indexOf(h.id) < 0) g2.appendChild(new Option(h.name + "（" + h.code + "）", h.id)); });
    sel.appendChild(g1); sel.appendChild(g2);
  })();
  function updateStopUI() {
    var on = !!$("hub").value, unit = $("stopUnit").value;
    $("stopDetail").hidden = !on;
    $("goOutRow").hidden = unit !== "h";
    $("stopLen").max = unit === "h" ? 23 : 10;
    $("hubHint").textContent = !on ? "乗り継ぎの待ち時間や、経由地に泊まる日数を予算に入れられます。"
      : unit === "h" ? "空港での食事代を入れます。10時間以上はホテル1泊分、空港の外に出る場合は市内への交通費・観光費と入国の手続き費用も加えます。"
      : "経由地に泊まります。旅行の日数は変えずに、その分だけ目的地での滞在が短くなります。航空券には途中降機の追加料金を加えます。";
  }

  var d0 = new Date(today().getTime() + 45 * DAY);
  $("dep").value = fmtDate(d0);
  $("ret").value = fmtDate(new Date(d0.getTime() + 4 * DAY));

  function radio(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }
  function dest() { return findTo($("to").value); }
  function checked(id) { var el = $("opt-" + id); return !!(el && el.checked); }

  function fillAirlines() {
    var t = dest(), sel = $("airline");
    sel.innerHTML = "";
    t.air.forEach(function (a, i) {
      var o = document.createElement("option");
      o.value = i; o.textContent = "【" + TYPE[a.t] + "】" + a.n;
      sel.appendChild(o);
    });
    sel.value = defaultAirline(t, radio("mode"));
    fillOpts();
  }

  function fillOpts() {
    var t = dest(), a = t.air[+$("airline").value], box = $("opts"), long = t.long ? 1 : 0;
    box.innerHTML = "";
    if (a.t === "lcc") {
      var def = defaultLccOpts(t, radio("mode"));
      LCC_OPTS.forEach(function (o) {
        box.insertAdjacentHTML("beforeend",
          '<label class="opt"><input type="checkbox" id="opt-' + o.id + '"' + (def[o.id] ? " checked" : "") + ">" + o.n +
          '<span class="p">+' + yen(o.p[long]) + "</span></label>");
      });
    } else {
      box.insertAdjacentHTML("beforeend",
        '<label class="opt"><input type="checkbox" id="opt-pe">プレミアムエコノミーにする<span class="p">運賃×' + PE_MULT + "</span></label>" +
        '<span class="hint">手荷物・機内食・座席指定は運賃に含まれます</span>');
    }
    $("airlineHint").textContent = AIR_HINT[a.t];
  }

  function calc() {
    var f = findFrom($("from").value), t = dest(), modeKey = radio("mode");
    var people = +$("people").value;
    var dep = parseDate($("dep").value), ret = parseDate($("ret").value);
    var err = "";
    if (!dep || !ret) err = "出発日と帰国日を選んでください。";
    else if (ret < dep) err = "帰国日が出発日より前になっています。";
    var days = err ? 5 : Math.round((ret - dep) / DAY) + 1;
    var minD = 2 + (t.night || 0);
    if (!err && days < minD) err = t.name + "は夜行便を含むため、" + minD + "日間以上で計算します。";
    if (!err && days > 60) err = "60日以内の日程で計算します。";
    if (!err && dep < today()) err = "出発日が過去の日付です。";
    days = Math.max(minD, Math.min(60, days));
    if (!dep) dep = today();

    // 経由地
    var stop = null, hubId = $("hub").value;
    if (hubId) {
      var hb = findHub(hubId), unit = $("stopUnit").value, len = parseInt($("stopLen").value, 10) || 1;
      if (hb.id === t.id) err = err || "経由地と旅行先が同じです。別の経由地を選んでください。";
      else {
        if (unit === "h") len = Math.max(1, Math.min(23, len));
        else {
          // 旅行先に1泊以上残す
          var maxStay = Math.min(10, days - 2 - (t.night || 0));
          if (maxStay < 1) { err = err || "日程が短いため、経由地に泊まる日数を取れません。"; len = 0; }
          else if (len > maxStay) { err = err || "経由地に泊まれるのは最大" + maxStay + "泊です（旅行先に1泊以上残すため）。"; len = maxStay; }
          len = Math.max(0, len);
        }
        if (len > 0) stop = { hub: hb, unit: unit, len: len, dir: $("stopDir").value, goOut: unit === "h" && $("goOut").checked };
      }
    }

    var override = parseFloat($("override").value);
    var e = estimate({
      f: f, t: t, mode: modeKey, ai: +$("airline").value, people: people, days: days, dep: dep, ret: ret,
      opts: { bag: checked("bag"), seat: checked("seat"), meal: checked("meal"), pe: checked("pe") },
      override: override > 0 ? override : 0, stop: stop
    });
    e.f = f; e.t = t; e.modeKey = modeKey; e.mode = MODE[modeKey]; e.people = people; e.stop = stop;
    e.dep = dep; e.ret = ret; e.days = days; e.err = err; e.override = override > 0;
    return e;
  }

  // ===== アフィリエイトリンク =====
  function bookUrl(cfg, r) {
    if (!cfg.url) return "";
    var checkin = new Date(r.dep.getTime() + (r.t.night ? DAY : 0));
    var retOk = r.ret && r.ret > checkin ? r.ret : new Date(checkin.getTime() + DAY);
    var vars = {
      fromSky: r.f.sky, toSky: r.t.sky, city: r.t.name, cityEn: r.t.en,
      depYmd: ymd(r.dep), retYmd: ymd(retOk), checkin: fmtDate(checkin), checkout: fmtDate(retOk), people: r.people
    };
    var url = cfg.url.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? encodeURIComponent(vars[k]) : m; });
    return cfg.wrap ? cfg.wrap.replace("{url}", encodeURIComponent(url)) : url;
  }
  function renderBook(r) {
    var active = AFF.filter(function (c) { return c.url; });
    $("book").hidden = !active.length;
    var anyPr = active.some(function (c) { return c.affiliate; });
    $("bookPr").hidden = !anyPr;
    $("bookList").innerHTML = active.map(function (c) {
      return '<a href="' + esc(bookUrl(c, r)) + '" target="_blank" rel="noopener' + (c.affiliate ? " sponsored" : "") + '"' + (c.primary ? ' class="primary"' : "") + ">" +
        esc(c.label) + (c.partner ? "<small>" + esc(c.partner) + "</small>" : "") + (c.affiliate ? '<span class="pr">PR</span>' : "") + " ↗</a>";
    }).join("");
    var fl = AFF.find(function (c) { return c.id === "flight" && c.url; });
    $("skyLink").hidden = !fl;
    if (fl) {
      $("skyLink").href = bookUrl(fl, r);
      $("skyLink").rel = "noopener" + (fl.affiliate ? " sponsored" : "");
      $("skyPr").hidden = !fl.affiliate;
    }
    var note = $("affNote");
    if (note) note.hidden = !AFF.some(function (c) { return c.url && c.affiliate; });
  }

  // ===== 旅行先ガイド =====
  var guideKey = "";
  function renderGuide(t, dep) {
    var key = t.id + "|" + fmtDate(dep);
    if (guideKey === key) return;
    guideKey = key;
    var g = TIPS[t.id];
    $("guideTitle").textContent = t.name + "の旅の注意点";
    $("best").innerHTML = "ベストシーズン <b>" + esc(g.best) + "</b>";
    $("jump").textContent = "↓ " + t.name + "の注意点とInstagramの投稿を見る";
    var url = function (tag) { return "https://www.instagram.com/explore/tags/" + encodeURIComponent(tag) + "/"; };
    $("insta").innerHTML = '<a class="main" href="' + url(g.tags[0]) + '" target="_blank" rel="noopener">#' + esc(g.tags[0]) + " の投稿を見る ↗</a>" +
      g.tags.slice(1).map(function (tag) { return '<a href="' + url(tag) + '" target="_blank" rel="noopener">#' + esc(tag) + "</a>"; }).join("");
    $("instaHint").textContent = "Instagramのハッシュタグ検索を新しいタブで開きます。ログインしていないと表示されないことがあります。" +
      (t.id === "shanghai" ? "中国本土の回線からはInstagramにつながらないため、日本で下調べしておくのがおすすめです。" : "");
    $("tips").innerHTML = entryCard(t, dep) + g.items.map(function (it) {
      return '<div class="tipc"><span class="t">' + esc(it[0]) + "</span><p>" + esc(it[1]) + "</p></div>";
    }).join("");
  }

  // ===== 都市ページ：大学生と標準の比較 =====
  function renderCompare() {
    var box = $("compare");
    if (!box || !pageCity) return;
    var t = findTo(pageCity), f = findFrom("kanto");
    var days = t.long ? 6 : 4;
    $("cmpTitle").textContent = t.name + " " + days + "日間の予算の目安（関東発・1人あたり・通常期）";
    $("cmpGrid").innerHTML = ["student", "standard"].map(function (m) {
      var e = estimate({ f: f, t: t, mode: m, ai: defaultAirline(t, m), people: 1, days: days, dep: null, ret: null, opts: defaultLccOpts(t, m), override: 0 });
      return '<div class="cmp"><span class="name">' + MODE[m].name + "（" + esc(e.a.n.replace(/（.*?）/g, "")) + "）</span>" +
        '<span class="big">約' + man(e.total) + "<small>万円</small></span><dl>" +
        e.items.map(function (it) { return "<dt>" + it.k + "</dt><dd>" + yen(it.v) + "</dd>"; }).join("") + "</dl></div>";
    }).join("");
    $("cmpNote").textContent = days + "日間（現地" + (days - 1 - (t.night || 0)) + "泊" + (t.night ? "・機内1泊" : "") +
      "）、平日出発の場合です。日程や航空会社を変えた見積もりは上の計算ツールで確認できます。";
    box.hidden = false;
  }

  // ===== 動きの演出 =====
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // CSSアニメーションをもう一度再生する
  function replay(el) {
    if (!el || reduce) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }
  // 空港の出発案内板のように文字を回してから止める
  function flipTo(el, text) {
    if (el.dataset.v === text) return;
    el.dataset.v = text;
    clearInterval(el._flip);
    if (reduce) { el.textContent = text; return; }
    var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", n = 0, last = 6 + (text.length - 1) * 3;
    el._flip = setInterval(function () {
      n++;
      el.textContent = text.split("").map(function (ch, i) { return n >= 6 + i * 3 ? ch : A[Math.floor(Math.random() * 26)]; }).join("");
      if (n >= last) clearInterval(el._flip);
    }, 45);
  }
  // 合計金額を数え上げる
  var shownTotal = 0, countRaf = 0;
  function setTotal(v) { $("total").innerHTML = "約" + man(v) + "<small>万円</small>"; }
  function countTo(target) {
    cancelAnimationFrame(countRaf);
    var from = shownTotal, t0 = performance.now(), dur = from ? 600 : 1100;
    if (reduce || from === target) { shownTotal = target; setTotal(target); return; }
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shownTotal = k < 1 ? from + (target - from) * e : target;
      setTotal(shownTotal);
      if (k < 1) countRaf = requestAnimationFrame(step);
    })(t0);
  }
  var shownDest = "";

  // ===== 画面の更新 =====
  function render() {
    var r = calc();
    if (shownDest && shownDest !== r.t.id) {
      replay(document.querySelector(".plane-icon"));
      replay($("bar"));
    }
    shownDest = r.t.id;
    if (SC) {
      SC.draw(r.t.id);
      $("sceneCap").textContent = "背景：" + SC.SCENES[r.t.id].cap;
    }
    renderGuide(r.t, r.dep);

    $("dateErr").hidden = !r.err;
    $("dateErr").textContent = r.err;
    $("daysOut").textContent = r.days + "日間";
    $("nightsHint").textContent = r.t.name + r.nights + "泊" +
      (r.stop && r.stop.unit === "d" ? "＋" + r.stop.hub.name + r.stop.len + "泊" : "") + (r.t.night ? "＋機内" + r.t.night + "泊" : "");
    $("modeHint").textContent = r.mode.hint;

    flipTo($("fromCode"), r.f.code);
    $("fromName").textContent = r.f.name;
    flipTo($("toCode"), r.t.code);
    $("toName").textContent = r.t.name;
    $("viaBox").hidden = !r.stop;
    if (r.stop) {
      $("viaCode").textContent = r.stop.hub.code;
      $("viaLen").textContent = (r.stop.dir === "out" ? "行き・" : "帰り・") + r.stop.len + (r.stop.unit === "h" ? "時間" : "泊");
    }
    $("chips").innerHTML = [r.mode.name, r.days + "日間", r.people + "名", r.se.n].concat(r.stop ? ["経由 " + r.stop.hub.name] : [])
      .map(function (c) { return '<span class="chip">' + c + "</span>"; }).join("");
    $("flightline").innerHTML = "<span>往路 <b>" + md(r.dep) + "</b></span>" +
      (r.ret ? "<span>復路 <b>" + md(r.ret) + "</b></span>" : "") + "<span>" + esc(r.a.n) + "</span>";

    countTo(r.total);
    $("range").innerHTML = "幅をみると <b>" + man(r.total * 0.85) + "〜" + man(r.total * 1.2) + "万円</b>（" + yen(r.total) + " を中心に）";
    $("perPerson").textContent = yen(r.total / r.people);
    $("perDay").textContent = yen((r.total - r.items[0].v) / r.people / r.days);
    $("flightPP").textContent = yen(r.flight1);

    $("factors").innerHTML = r.factors.map(function (x) {
      return '<span class="fchip ' + x.dir + '">' + esc(x.n) + "<b>" + x.v + "</b></span>";
    }).join("");

    var bar = $("bar"), rows = "";
    bar.innerHTML = "";
    r.items.forEach(function (it) {
      var pct = it.v / r.total * 100;
      var seg = document.createElement("div");
      seg.style.flexBasis = pct + "%";
      seg.style.background = "var(" + it.c + ")";
      seg.tabIndex = 0;
      seg.setAttribute("aria-label", it.k + " " + yen(it.v));
      seg.dataset.label = it.k;
      seg.dataset.value = yen(it.v) + "（" + Math.round(pct) + "%）";
      bar.appendChild(seg);
      rows += '<tr><td><div class="cat"><span class="sw" style="background:var(' + it.c + ')"></span>' + it.k +
        '</div><div class="calc">' + esc(it.calc) + '</div></td><td class="amt">' + yen(it.v) +
        '</td><td class="pct">' + Math.round(pct) + "%</td></tr>";
    });
    $("rows").innerHTML = rows;
    renderBook(r);

    var notes = [];
    if (r.override) notes.push("航空券は入力された料金で計算しています。LCCの場合、比較サイトの表示額に手荷物などのオプションは含まれないため、選んだオプションを上乗せしています。");
    else notes.push("航空券は当サイト独自の目安です。比較サイトで実際の料金を確認し、上の欄に入力すると正確になります。");
    if (r.t.night) notes.push("往路か復路が夜行便になるため、" + r.days + "日間のうち1泊は機内泊として宿泊費から除いています。");
    if (r.modeKey === "student") notes.push("学割はISIC国際学生証（発行手数料は別途）や学生証の提示で使える美術館・観光施設の割引を想定しています。");
    else notes.push("宿泊は2名で1室として計算しています。");
    if (r.stop) {
      var sx = r.stop, hn = sx.hub.name, dirTxt = sx.dir === "out" ? "行き" : "帰り";
      if (sx.unit === "h") notes.push(hn + "での" + sx.len + "時間の乗り継ぎ（" + dirTxt + "）を入れています。" + (sx.len >= 10 ? "10時間以上なので空港近くのホテル1泊分も含めています。" : ""));
      else notes.push(hn + "に" + sx.len + "泊立ち寄ります（" + dirTxt + "）。そのぶん" + r.t.name + "での滞在は" + r.nights + "泊になります。");
      if (r.viaSwitched) notes.push("経由地を指定したため、航空券は乗継便の料金で計算しています。");
      if (TRANSIT_FEE[sx.hub.id]) notes.push("アメリカ・カナダは、空港から出ない乗り継ぎでもESTA・eTAが必要です。");
      if ((sx.unit === "d" || sx.goOut) && r.hubEntry && r.hubEntry.rule) {
        notes.push(hn + "の入国条件：" + (r.hubEntry.expired ? (r.hubEntry.rule.after || "最新の入国条件を確認してください。") : r.hubEntry.rule.text));
      }
    }
    if (r.entry.expired) notes.unshift("入国：" + (r.entry.rule.after || "この日程は入国措置の期限を過ぎています。") + "この費用は予算に含めていません。");
    notes.push("クレジットカード付帯の海外旅行保険を使えば、保険料はかからない場合があります。");
    $("notes").innerHTML = notes.map(function (n) { return "<li>" + n + "</li>"; }).join("");
  }

  // ツールチップ
  var tip = $("tip");
  function showTip(e) {
    var seg = e.target.closest(".bar div");
    if (!seg) return;
    var wrap = $("bar").getBoundingClientRect(), rc = seg.getBoundingClientRect();
    var x = Math.max(70, Math.min(wrap.width - 70, rc.left + rc.width / 2 - wrap.left));
    tip.innerHTML = seg.dataset.label + " <b>" + seg.dataset.value + "</b>";
    tip.style.left = x + "px";
    tip.hidden = false;
  }
  function hideTip() { tip.hidden = true; }
  $("bar").addEventListener("mouseover", showTip);
  $("bar").addEventListener("focusin", showTip);
  $("bar").addEventListener("mouseleave", hideTip);
  $("bar").addEventListener("focusout", hideTip);

  function shiftReturn(n) {
    var dep = parseDate($("dep").value), ret = parseDate($("ret").value) || dep;
    if (!dep) return;
    var next = new Date(ret.getTime() + n * DAY);
    if (next < dep) next = dep;
    $("ret").value = fmtDate(next);
    render();
  }

  $("form").addEventListener("change", function (e) {
    var id = e.target.id;
    if (e.target.name === "mode" || id === "to") { $("override").value = ""; fillAirlines(); }
    else if (id === "airline") fillOpts();
    else if (id === "stopUnit") { $("stopLen").value = e.target.value === "h" ? 5 : 1; updateStopUI(); }
    else if (id === "hub") updateStopUI();
    else if (id === "dep") {
      // 出発日を動かしたら日数を保って帰国日もずらす
      var dep = parseDate(e.target.value), prev = parseDate(e.target.dataset.prev || ""), ret = parseDate($("ret").value);
      if (dep && prev && ret) $("ret").value = fmtDate(new Date(ret.getTime() + (dep - prev)));
      e.target.dataset.prev = e.target.value;
    }
    render();
  });
  $("form").addEventListener("input", function (e) { if (e.target.id === "override" || e.target.id === "stopLen") render(); });
  $("form").addEventListener("submit", function (e) { e.preventDefault(); });
  $("minus").addEventListener("click", function () { shiftReturn(-1); });
  $("plus").addEventListener("click", function () { shiftReturn(1); });
  $("clearOverride").addEventListener("click", function () { $("override").value = ""; render(); });

  // find.html からのリンク（?mode=student&days=5&people=2&from=kanto&dep=2026-12-10）で条件を引き継ぐ
  (function applyParams() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var m = q.get("mode");
    if (m === "student" || m === "standard") { var r = document.querySelector('input[name="mode"][value="' + m + '"]'); if (r) r.checked = true; }
    var pe = q.get("people"); if (pe && /^[1-6]$/.test(pe)) $("people").value = pe;
    var fr = q.get("from"); if (fr && findFrom(fr)) $("from").value = fr;
    var dp = q.get("dep"); if (dp && /^\d{4}-\d{2}-\d{2}$/.test(dp)) $("dep").value = dp;
    var dy = parseInt(q.get("days"), 10);
    if (dy >= 2 && dy <= 60) { var d1 = parseDate($("dep").value); if (d1) $("ret").value = fmtDate(new Date(d1.getTime() + (dy - 1) * DAY)); }
  })();

  $("dep").dataset.prev = $("dep").value;
  fillAirlines();
  updateStopUI();
  renderCompare();
  render();
})();
