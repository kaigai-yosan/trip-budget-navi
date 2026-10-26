// 予算から行き先を探す・行き先診断。見積もりの計算は app.js の estimate をそのまま使う
(function () {
  "use strict";
  var D = window.TRIP, C = window.TRIP_CALC;
  if (!D || !C) return;
  var TO = D.TO, FROM = D.FROM, TIPS = D.TIPS, VIBES = D.VIBES || {};
  var yen = C.yen, man = C.man, DAY = C.DAY, TYPE = C.TYPE;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function fmtDate(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd; }
  function parseDate(s) { if (!s) return null; var p = s.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? null : d; }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  var VIBE_LABEL = { food: "グルメ", beach: "ビーチ・リゾート", city: "街歩き・買い物", culture: "歴史・文化", nature: "絶景・自然", night: "夜景・ナイトライフ" };
  var AREAS = [];
  TO.forEach(function (t) { if (AREAS.indexOf(t.g) < 0) AREAS.push(t.g); });

  // ===== 共通：1都市ぶんの見積もり =====
  function calcCity(t, o) {
    var minD = 2 + (t.night || 0);
    if (o.days < minD) return { t: t, short: minD };
    var ai = C.defaultAirline(t, o.mode);
    var dep = o.dep || null, ret = dep ? new Date(dep.getTime() + (o.days - 1) * DAY) : null;
    var e = C.estimate({
      f: o.from, t: t, mode: o.mode, ai: ai, people: o.people, days: o.days, dep: dep, ret: ret,
      opts: C.defaultLccOpts(t, o.mode), override: 0, stop: null
    });
    return { t: t, e: e, per: e.total / o.people, a: e.a };
  }
  function linkTo(t, o) {
    var q = ["mode=" + o.mode, "days=" + o.days, "people=" + o.people, "from=" + o.from.id];
    if (o.dep) q.push("dep=" + fmtDate(o.dep));
    return "cities/" + t.id + ".html?" + q.join("&") + "#form";
  }
  function planLink(t, o) {
    var q = ["city=" + t.id, "mode=" + o.mode, "days=" + o.days, "people=" + o.people, "from=" + o.from.id];
    if (o.dep) q.push("dep=" + fmtDate(o.dep));
    return "plan.html?" + q.join("&");
  }
  function miniBar(e) {
    var total = e.total || 1;
    return '<div class="minibar" aria-hidden="true">' + e.items.map(function (it) {
      return '<i style="flex:' + (it.v / total * 100).toFixed(2) + ' 1 0;background:var(' + it.c + ')"></i>';
    }).join("") + "</div>";
  }
  function airName(r) {
    var base = r.a.n.replace(/（.*?）/g, "");
    return base === TYPE[r.a.t] ? r.a.n : base + "（" + TYPE[r.a.t] + "）"; // 「乗継便（乗継便）」のような重複を避ける
  }
  function card(r, o, extra) {
    var e = r.e, rankHtml = extra.rank ? '<span class="rank">' + extra.rank + "位</span> " : "";
    var diffHtml = "";
    if (extra.budget) {
      var d = extra.budget - r.per;
      diffHtml = d >= 0 ? '<span class="diff">予算まであと約' + man(d) + "万円</span>" : '<span class="diff neg">予算を約' + man(-d) + "万円オーバー</span>";
    }
    return '<article class="rcard' + (extra.over ? " over" : "") + '" style="animation-delay:' + Math.min(extra.i * 0.04, 0.5) + 's">' +
      '<div class="top"><span class="name">' + rankHtml + esc(r.t.name) + '</span><span class="code">' + esc(r.t.code) + "</span></div>" +
      '<div class="price">約' + man(r.per) + "<small>万円</small></div>" + diffHtml + miniBar(e) +
      '<div class="meta"><span>現地' + e.nights + "泊" + (r.t.night ? "（機内泊あり）" : "") + "</span><span>航空券 " + yen(e.flight1) + "</span><span>" + esc(airName(r)) + "</span></div>" +
      (extra.why ? '<p class="why">' + esc(extra.why) + "</p>" : "") +
      '<div class="golinks"><a class="go" href="' + esc(linkTo(r.t, o)) + '">詳しく計算する →</a>' +
      '<a class="go" href="' + esc(planLink(r.t, o)) + '">しおりを作る →</a></div></article>';
  }

  // ===== 初期化 =====
  [$("bFrom"), $("qFrom")].forEach(function (sel) {
    FROM.forEach(function (f) { var o = new Option(f.name + "（" + f.code + " など）", f.id); if (f.id === "kanto") o.selected = true; sel.appendChild(o); });
  });
  $("bAreas").innerHTML = AREAS.map(function (g, i) { return '<label><input type="checkbox" value="' + esc(g) + '" checked><span>' + esc(g) + "</span></label>"; }).join("");
  $("qInterests").innerHTML = Object.keys(VIBE_LABEL).map(function (k) { return '<label><input type="checkbox" value="' + k + '"><span>' + VIBE_LABEL[k] + "</span></label>"; }).join("");
  var mo = $("qMonth");
  mo.appendChild(new Option("決まっていない", "0"));
  for (var m = 1; m <= 12; m++) mo.appendChild(new Option(m + "月", String(m)));
  var nextMonth = ((new Date().getMonth() + 1) % 12) + 1;
  mo.value = String(nextMonth);

  // ===== 予算から探す =====
  var budgetShown = false;
  function renderBudget() {
    // 入力のたびに出現の動きをやり直さない（最初の1回だけ動かす）
    $("bResults").classList.toggle("static", budgetShown);
    budgetShown = true;
    var budget = (parseFloat($("bBudget").value) || 0) * 10000;
    var days = clamp(parseInt($("bDays").value, 10) || 5, 2, 21);
    var people = +$("bPeople").value;
    var dep = parseDate($("bDep").value);
    if (dep && dep < today()) dep = null;
    var o = { mode: radio("bMode"), days: days, people: people, from: C.findFrom($("bFrom").value), dep: dep };
    var areas = {};
    document.querySelectorAll("#bAreas input:checked").forEach(function (el) { areas[el.value] = 1; });
    if (budget <= 0) { $("bSummary").textContent = "予算を入力してください。"; $("bResults").innerHTML = ""; $("bNote").textContent = ""; return; }

    var rows = TO.filter(function (t) { return areas[t.g]; }).map(function (t) { return calcCity(t, o); });
    var ok = rows.filter(function (r) { return r.e; }), shorts = rows.filter(function (r) { return r.short; });
    var within = ok.filter(function (r) { return r.per <= budget; });
    var near = ok.filter(function (r) { return r.per > budget && r.per <= budget * 1.2; });
    var asc = function (a, b) { return a.per - b.per; };
    within.sort($("bSort").value === "cheap" ? asc : function (a, b) { return b.per - a.per; });
    near.sort(asc);

    $("bSummary").innerHTML = "<b>" + within.length + "</b>都市が予算内で行けます" + (near.length ? "（あと少しで行ける都市が" + near.length + "都市）" : "");
    var html = within.map(function (r, i) { return card(r, o, { budget: budget, i: i }); }).join("") +
      near.map(function (r, i) { return card(r, o, { budget: budget, over: true, i: within.length + i }); }).join("");
    if (!html) html = '<p class="hint">この条件で行ける都市がありません。予算を上げるか、日数を減らしてみてください。' +
      (ok.length ? "（いちばん安いのは" + esc(ok.slice().sort(asc)[0].t.name) + "で約" + man(ok.slice().sort(asc)[0].per) + "万円です）" : "") + "</p>";
    $("bResults").innerHTML = html;
    $("bNote").textContent = (shorts.length ? shorts.map(function (r) { return r.t.name; }).join("・") + "は夜行便を含むため、" + days + "日間では行きにくい都市です（最低" + shorts[0].short + "日が必要）。" : "") +
      (dep ? "" : " 出発日が空欄のため、通常期・平日出発の目安です。");
  }
  $("bForm").addEventListener("input", renderBudget);
  $("bForm").addEventListener("change", renderBudget);
  $("bForm").addEventListener("submit", function (e) { e.preventDefault(); });
  $("bSort").addEventListener("change", renderBudget);

  // ===== 行き先診断 =====
  function bestMonths(id) {
    var s = (TIPS[id] && TIPS[id].best) || "", set = {}, re = /(\d+)〜(\d+)月/g, m;
    while ((m = re.exec(s))) {
      var a = +m[1], b = +m[2];
      for (var x = a, n = 0; n < 13; x = x % 12 + 1, n++) { set[x] = 1; if (x === b) break; }
    }
    return set;
  }
  $("qInterests").addEventListener("change", function () {
    var boxes = document.querySelectorAll("#qInterests input"), n = document.querySelectorAll("#qInterests input:checked").length;
    boxes.forEach(function (b) { b.disabled = !b.checked && n >= 2; });
  });

  function runQuiz() {
    var interests = Array.prototype.map.call(document.querySelectorAll("#qInterests input:checked"), function (el) { return el.value; });
    var days = +radio("qDays"), budgetMan = +radio("qBudget"), month = +$("qMonth").value, mode = radio("qMode"), first = radio("qFirst") === "1";
    var o = { mode: mode, days: days, people: 1, from: C.findFrom($("qFrom").value), dep: null };
    var limit = budgetMan * 10000;

    var list = [];
    TO.forEach(function (t) {
      var r = calcCity(t, o);
      if (!r.e) return;
      var vibes = VIBES[t.id] || [], reasons = [], score = 0, hit = [];
      interests.forEach(function (k) { if (vibes.indexOf(k) >= 0) { score += 3; hit.push(VIBE_LABEL[k]); } });
      if (hit.length) reasons.push(hit.join("・") + "が楽しめる");
      if (first && vibes.indexOf("easy") >= 0) { score += 2; reasons.push("初めてでも行きやすい"); }
      if (month && bestMonths(t.id)[month]) { score += 2; reasons.push(month + "月はベストシーズン"); }
      var hard = false;
      if (limit) {
        if (r.per <= limit) { score += 2; reasons.push("予算内（約" + man(r.per) + "万円）"); }
        else if (r.per <= limit * 1.15) reasons.push("予算を少し超えます（約" + man(r.per) + "万円）");
        else hard = true;
      } else reasons.push("約" + man(r.per) + "万円");
      if (days <= 4 && t.long) { score -= 2; reasons.push("日数が短めで、移動に時間がかかります"); }
      score -= r.per / 1e7;
      list.push({ r: r, score: score, reasons: reasons, hard: hard });
    });
    list.sort(function (a, b) { return b.score - a.score; });
    var pick = list.filter(function (x) { return !x.hard; }).slice(0, 5);
    if (pick.length < 5) pick = pick.concat(list.filter(function (x) { return x.hard; }).sort(function (a, b) { return a.r.per - b.r.per; }).slice(0, 5 - pick.length));

    $("qMsg").textContent = interests.length ? "" : "やりたいことを選ぶと、もっと絞れます。";
    $("qResults").innerHTML = pick.length ? pick.map(function (x, i) {
      return card(x.r, o, { rank: i + 1, i: i, over: x.hard, why: x.reasons.join("。") + "。" });
    }).join("") : '<p class="hint">条件に合う行き先がありませんでした。日数や予算を変えてみてください。</p>';
    $("qResults").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("qForm").addEventListener("submit", function (e) { e.preventDefault(); runQuiz(); });

  renderBudget();
})();
