// 旅のしおり作成：行き先のスポットのデータから日ごとの予定を組み、予算の目安とAIへの依頼文も作る
(function () {
  "use strict";
  var D = window.TRIP, C = window.TRIP_CALC, S = window.TRIP_SPOTS || {};
  if (!D || !C) return;
  var TO = D.TO, FROM = D.FROM, TIPS = D.TIPS;
  var yen = C.yen, man = C.man, DAY = C.DAY, TYPE = C.TYPE;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function fmtDate(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd; }
  function parseDate(s) { if (!s) return null; var p = s.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? null : d; }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  var WD = ["日", "月", "火", "水", "木", "金", "土"];
  function md(d) { return (d.getMonth() + 1) + "/" + d.getDate() + "（" + WD[d.getDay()] + "）"; }
  function jaFull(d) { return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日"; }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function findTo(id) { return C.findTo(id); }

  var VIBE_LABEL = { food: "グルメ", beach: "ビーチ・リゾート", city: "街歩き・買い物", culture: "歴史・文化", nature: "絶景・自然", night: "夜景・ナイトライフ" };
  var LETTER = { food: "f", beach: "b", city: "c", culture: "u", nature: "n", night: "g" };
  var TAG_SHORT = { f: "グルメ", b: "ビーチ", c: "街歩き", u: "文化", n: "絶景", g: "夜景" };
  var PACE = {
    relaxed: { name: "ゆったり", per: "1日2か所（午前は朝寝坊やカフェ）", slots: [{ k: "a", l: "午後" }, { k: "e", l: "夜" }] },
    normal: { name: "ふつう", per: "1日3か所", slots: [{ k: "m", l: "午前" }, { k: "a", l: "午後" }, { k: "e", l: "夜" }] },
    packed: { name: "ぎっしり", per: "1日5か所", slots: [{ k: "m", l: "朝" }, { k: "m", l: "午前" }, { k: "a", l: "午後" }, { k: "a", l: "夕方" }, { k: "e", l: "夜" }] }
  };
  var FILL = {
    m: { n: "朝のカフェと散歩", note: "ホテルの近くでゆっくり朝食。気に入ったお店を探しましょう" },
    a: { n: "自由時間", note: "気になるエリアを歩いたり、お土産を探したりします" },
    e: { n: "夕食と夜の散歩", note: "行ってみたいお店でゆっくり食事。夜道は人通りのある場所を" }
  };

  // ===== スポットのデータ =====
  var parsed = {};
  function spotsOf(id) {
    if (parsed[id]) return parsed[id];
    parsed[id] = (S[id] || []).map(function (line) {
      var p = line.split("|");
      return { n: p[0], area: p[1], tags: p[2] || "", slot: p[3] || "*", note: p[4] || "" };
    });
    return parsed[id];
  }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ===== しおりを組む =====
  function schedule(t, days, normal) {
    var plan = [], i;
    if (t.night) {
      plan.push({ title: "出発（機内泊）", slots: [], text: "日本を出発します。機内で一泊します。" });
      plan.push({ title: "到着・" + t.name, slots: [{ k: "a", l: "午後" }, { k: "e", l: "夜" }], text: "ホテルにチェックイン。時差と疲れに合わせて、無理せず過ごします。" });
      for (i = 2; i < days - 1; i++) plan.push({ title: "", slots: normal });
      plan.push({ title: "帰国", slots: [{ k: "m", l: "午前" }], text: "チェックアウトして空港へ。お土産は早めに買っておきましょう。" });
    } else {
      plan.push({ title: "出発・到着", slots: [{ k: "e", l: "夜" }], text: "午後までに到着。ホテルに荷物を預けて、夜に動きます。" });
      for (i = 1; i < days - 1; i++) plan.push({ title: "", slots: normal });
      plan.push({ title: "帰国", slots: [{ k: "m", l: "午前" }], text: "チェックアウトして空港へ。余裕をもって出発しましょう。" });
    }
    return plan;
  }

  function generate(o) {
    var spots = spotsOf(o.t.id), used = {}, rand = rng(o.seed * 7919 + 13);
    var plan = schedule(o.t, o.days, PACE[o.pace].slots);

    function pick(kind, area) {
      var best = -1, bestScore = -1e9;
      spots.forEach(function (s, i) {
        if (used[i]) return;
        var sc = 0;
        if (s.slot === kind) sc += 2; else if (s.slot === "*") sc += 1; else sc -= 3;
        o.interests.forEach(function (k) { if (s.tags.indexOf(LETTER[k]) >= 0) sc += 2; });
        if (kind === "e" && (s.tags.indexOf("f") >= 0 || s.tags.indexOf("g") >= 0)) sc += 1.5;
        if (kind !== "e" && s.tags.indexOf("g") >= 0 && s.slot === "e") sc -= 2;
        if (area && s.area === area) sc += 1.5;
        sc -= i * 0.01;
        if (o.seed) sc += rand() * 1.4;
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      if (best < 0 || bestScore < -2) return null; // ふさわしい候補がなければ自由時間にする
      used[best] = 1;
      return spots[best];
    }

    plan.forEach(function (day, di) {
      var area = null, areas = [];
      day.items = day.slots.map(function (sl) {
        var s = pick(sl.k, area);
        if (!s) return { label: sl.l, spot: { n: FILL[sl.k].n, area: "", tags: "", note: FILL[sl.k].note }, free: true };
        if (!area) area = s.area;
        if (areas.indexOf(s.area) < 0) areas.push(s.area);
        return { label: sl.l, spot: s, free: false };
      });
      day.no = di + 1;
      day.date = o.dep ? new Date(o.dep.getTime() + di * DAY) : null;
      if (!day.title) day.title = areas.length ? areas.slice(0, 2).join("・") + "を中心に" : "自由に過ごす日";
    });
    return plan;
  }

  // ===== 予算の目安 =====
  function estimate(o) {
    var ret = o.dep ? new Date(o.dep.getTime() + (o.days - 1) * DAY) : null;
    return C.estimate({
      f: o.from, t: o.t, mode: o.mode, ai: C.defaultAirline(o.t, o.mode), people: o.people, days: o.days, dep: o.dep, ret: ret,
      opts: C.defaultLccOpts(o.t, o.mode), override: 0, stop: null
    });
  }
  function airName(a) { var base = a.n.replace(/（.*?）/g, ""); return base === TYPE[a.t] ? a.n : base + "（" + TYPE[a.t] + "）"; }

  // ===== 画面に出す =====
  var state = { seed: 0, plan: null, o: null, e: null };
  function readOptions() {
    var t = findTo($("pCity").value), minD = 2 + (t.night || 0);
    var days = parseInt($("pDays").value, 10) || 5;
    var dep = parseDate($("pDep").value);
    var interests = Array.prototype.map.call(document.querySelectorAll("#pInterests input:checked"), function (el) { return el.value; });
    return {
      t: t, from: C.findFrom($("pFrom").value), dep: dep, days: clamp(days, minD, 21), rawDays: days, minD: minD,
      people: +$("pPeople").value, mode: radio("pMode"), pace: radio("pPace"), interests: interests, seed: state.seed
    };
  }

  function render() {
    var o = readOptions();
    $("pErr").textContent = "";
    if (o.rawDays < o.minD) {
      $("pErr").textContent = o.t.name + "は夜行便を含むため、" + o.minD + "日間以上で作ります。日数を" + o.minD + "日にして作成しました。";
      $("pDays").value = String(o.minD);
    }
    if (!o.dep) { $("pErr").textContent = ($("pErr").textContent + " 出発日を選ぶと、日付と入国条件も出ます。").trim(); }
    var plan = generate(o), e = estimate(o);
    state.plan = plan; state.o = o; state.e = e;

    var perPerson = e.total / o.people;
    var daily = (e.items[2].v + e.items[3].v + e.items[4].v) / o.people / (e.nights + 1);
    var modeName = C.MODE[o.mode].name;
    $("pOverview").innerHTML =
      "<h2>" + esc(o.t.name) + " " + o.days + "日間のしおり</h2>" +
      '<div class="ovgrid">' +
      ov("日程", (o.dep ? md(o.dep) + "〜" + md(new Date(o.dep.getTime() + (o.days - 1) * DAY)) : o.days + "日間")) +
      ov("プラン", modeName + '<small>' + esc(PACE[o.pace].name) + "</small>") +
      ov("予算の目安（1人）", "約" + man(perPerson) + "万円") +
      ov("合計（" + o.people + "名）", "約" + man(e.total) + "万円") +
      ov("航空券（1人往復）", yen(e.flight1) + "<small>" + esc(airName(e.a)) + "</small>") +
      ov("現地での1日の費用", "約" + yen(daily) + "<small>食費・交通・観光</small>") +
      "</div>";

    $("pDayList").innerHTML = plan.map(function (d) {
      return '<article class="day"><div class="dayhead"><span class="dno">Day ' + d.no + "</span>" +
        (d.date ? '<span class="ddate">' + md(d.date) + "</span>" : "") + "<h3>" + esc(d.title) + "</h3></div>" +
        (d.text ? '<p class="dtext">' + esc(d.text) + "</p>" : "") +
        (d.items.length ? '<ol class="slots">' + d.items.map(function (it) {
          var s = it.spot, tags = s.tags.split("").map(function (c) { return TAG_SHORT[c] ? "<i>" + TAG_SHORT[c] + "</i>" : ""; }).join("");
          return '<li class="slot' + (it.free ? " free" : "") + '"><span class="when">' + it.label + "</span><div><span class=\"nm\">" + esc(s.n) + "</span>" +
            (s.area ? '<span class="ar">' + esc(s.area) + "</span>" : "") + (tags ? '<span class="tg">' + tags + "</span>" : "") +
            (s.note ? "<p>" + esc(s.note) + "</p>" : "") + "</div></li>";
        }).join("") + "</ol>" : "") + "</article>";
    }).join("");

    // 出発前の確認
    var en = C.entryFor(o.t.id, fmtDate(o.dep || today())), r = en.rule, items = [];
    if (r) items.push('<div class="tipc' + (en.expired ? " warn" : "") + '"><span class="t">入国</span><p>' + esc(en.expired ? (r.after || "措置の期限を過ぎています。最新の情報を確認してください。") : r.text) + "</p></div>");
    ((TIPS[o.t.id] && TIPS[o.t.id].items) || []).forEach(function (it) {
      if (it[0] === "お金" || it[0] === "治安" || it[0] === "マナー") items.push('<div class="tipc"><span class="t">' + esc(it[0]) + "</span><p>" + esc(it[1]) + "</p></div>");
    });
    $("pCheck").innerHTML = "<h3>出発前の確認</h3>" + items.join("");

    $("promptBox").value = buildPrompt(o, e, plan, en);
  }
  function ov(k, v) { return '<div class="ovitem"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>"; }

  // ===== テキストと依頼文 =====
  function planText(o, e, plan) {
    var lines = ["【" + o.t.name + " " + o.days + "日間の旅のしおり】"];
    if (o.dep) lines.push("日程：" + jaFull(o.dep) + "〜" + jaFull(new Date(o.dep.getTime() + (o.days - 1) * DAY)));
    lines.push("予算の目安：1人約" + man(e.total / o.people) + "万円（" + o.people + "名で約" + man(e.total) + "万円）", "");
    plan.forEach(function (d) {
      lines.push("■ Day" + d.no + (d.date ? "（" + md(d.date) + "）" : "") + " " + d.title);
      if (d.text) lines.push("  " + d.text);
      d.items.forEach(function (it) { lines.push("  " + it.label + "：" + it.spot.n + (it.spot.area ? "（" + it.spot.area + "）" : "") + (it.spot.note ? " … " + it.spot.note : "")); });
      lines.push("");
    });
    return lines.join("\n");
  }
  function buildPrompt(o, e, plan, en) {
    var from = o.from, long = !!o.t.night;
    var entry = en.rule ? (en.expired ? (en.rule.after || "") : en.rule.text) : "";
    var L = [
      "あなたは海外旅行のプランナーです。次の条件で、日ごとの旅のしおりを日本語で作ってください。",
      "",
      "【旅の条件】",
      "・行き先：" + o.t.name,
      "・出発地：" + from.name + "（" + from.code + "）",
      "・日程：" + (o.dep ? jaFull(o.dep) + "〜" + jaFull(new Date(o.dep.getTime() + (o.days - 1) * DAY)) + "、" : "") + o.days + "日間" +
        "（現地" + (o.days - 1 - (o.t.night || 0)) + "泊" + (long ? "、機内泊あり" : "") + "）",
      "・人数：" + o.people + "名" + (o.mode === "student" ? "（大学生）" : ""),
      "・旅のスタイル：" + (o.mode === "student" ? "大学生の節約旅（LCCや乗継便、ドミトリーなど相部屋、ローカル食堂中心）" : "標準（直行便、3つ星クラスのホテル、レストランも適度に）"),
      "・予算：1人あたり約" + man(e.total / o.people) + "万円（航空券・宿泊・食費・現地交通・観光・保険を含む）",
      "・やりたいこと：" + (o.interests.length ? o.interests.map(function (k) { return VIBE_LABEL[k]; }).join("、") : "特になし（定番を中心に）"),
      "・旅のペース：" + PACE[o.pace].name + "（" + PACE[o.pace].per + "）",
      ""
    ];
    if (entry) L.push("【入国・現地の注意】", entry, "");
    L.push("【サイトで作った、たたき台のしおり】", "次の案をもとに、足りない情報を補って、より現実的で詳しいしおりにしてください。", "", planText(o, e, plan), "【お願い】",
      "・日ごとに、時間帯（午前・午後・夜）、場所、移動手段と所要時間の目安、食事のおすすめ（料理や店のジャンル）、かかる費用の目安を書いてください。",
      "・無理のない順番になるよう、近い場所をまとめて回るようにしてください。",
      "・予算を超えそうな場合は、安く済ませる代わりの案も出してください。",
      "・雨の日の代わりの予定も、1日に1つずつ添えてください。",
      "・営業時間・休館日・予約が必要かどうかは変わるので、確認が必要な項目には「要確認」と付けてください。",
      "・最後に、持ち物リストと、現地で気をつけることをまとめてください。");
    return L.join("\n");
  }

  // ===== 初期化 =====
  var groups = {};
  TO.forEach(function (t) {
    if (!groups[t.g]) { groups[t.g] = document.createElement("optgroup"); groups[t.g].label = t.g; $("pCity").appendChild(groups[t.g]); }
    groups[t.g].appendChild(new Option(t.name, t.id));
  });
  FROM.forEach(function (f) { var op = new Option(f.name + "（" + f.code + " など）", f.id); if (f.id === "kanto") op.selected = true; $("pFrom").appendChild(op); });
  $("pInterests").innerHTML = Object.keys(VIBE_LABEL).map(function (k) { return '<label><input type="checkbox" value="' + k + '"><span>' + VIBE_LABEL[k] + "</span></label>"; }).join("");
  $("pCity").value = "paris";
  $("pDep").value = fmtDate(new Date(today().getTime() + 45 * DAY));

  // find.html などからのリンク（?city=paris&mode=student&days=5&people=2&from=kanto&dep=2026-12-10）で条件を引き継ぐ
  (function applyParams() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var c = q.get("city"); if (c && findTo(c)) $("pCity").value = c;
    var m = q.get("mode"); if (m === "student" || m === "standard") document.querySelector('input[name="pMode"][value="' + m + '"]').checked = true;
    var pe = q.get("people"); if (pe && /^[1-4]$/.test(pe)) $("pPeople").value = pe;
    var fr = q.get("from"); if (fr && C.findFrom(fr)) $("pFrom").value = fr;
    var dp = q.get("dep"); if (dp && /^\d{4}-\d{2}-\d{2}$/.test(dp)) $("pDep").value = dp;
    var dy = parseInt(q.get("days"), 10); if (dy >= 2 && dy <= 21) $("pDays").value = String(dy);
  })();
  $("pDays").value = $("pDays").value || "5";

  $("pInterests").addEventListener("change", function () {
    var n = document.querySelectorAll("#pInterests input:checked").length;
    document.querySelectorAll("#pInterests input").forEach(function (b) { b.disabled = !b.checked && n >= 3; });
  });
  $("pForm").addEventListener("change", function (e) { if (e.target.id === "pCity") state.seed = 0; render(); });
  $("pForm").addEventListener("input", function (e) { if (e.target.id === "pDays") render(); });
  $("pForm").addEventListener("submit", function (e) { e.preventDefault(); });
  $("reroll").addEventListener("click", function () { state.seed++; render(); });

  // コピー
  function copyText(text, msgEl, ok) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta); ta.select();
      var done = false;
      try { done = document.execCommand("copy"); } catch (e) { done = false; }
      ta.remove();
      msgEl.textContent = done ? ok : "コピーできませんでした。枠の中の文章を選んで、手動でコピーしてください。";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { msgEl.textContent = ok; }, fallback);
    } else fallback();
    setTimeout(function () { if (msgEl.textContent === ok) msgEl.textContent = ""; }, 4000);
  }
  $("copyPlan").addEventListener("click", function () { copyText(planText(state.o, state.e, state.plan), $("copyMsg"), "しおりをコピーしました。"); });
  $("copyPrompt").addEventListener("click", function () { copyText($("promptBox").value, $("promptMsg"), "依頼文をコピーしました。AIの入力欄に貼り付けてください。"); });
  $("printPlan").addEventListener("click", function () { window.print(); });

  render();
})();
