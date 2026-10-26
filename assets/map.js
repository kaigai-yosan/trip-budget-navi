// 旅の世界地図：写真はこの端末のブラウザ（IndexedDB）の中だけに保存し、どこにも送信しない
(function () {
  "use strict";
  var D = window.TRIP || { TO: [], HUBS: [] };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function fmtDate(d) {
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd;
  }
  function jaDate(s) { var p = s.split("-"); return +p[0] + "年" + +p[1] + "月" + +p[2] + "日"; }

  var WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  var W = 960, H = 500;

  // 予算ナビの都市の位置 [経度, 緯度, 国・地域コード]
  var CITY_POS = {
    seoul: [126.98, 37.57, "KR"], busan: [129.08, 35.18, "KR"], jeju: [126.53, 33.5, "KR"], taipei: [121.56, 25.04, "TW"],
    hongkong: [114.17, 22.32, "HK"], shanghai: [121.47, 31.23, "CN"], beijing: [116.41, 39.9, "CN"], bangkok: [100.5, 13.76, "TH"],
    hcm: [106.7, 10.78, "VN"], danang: [108.22, 16.05, "VN"], hanoi: [105.85, 21.03, "VN"], singapore: [103.82, 1.35, "SG"],
    bali: [115.19, -8.65, "ID"], cebu: [123.89, 10.32, "PH"], kualalumpur: [101.69, 3.14, "MY"], siemreap: [103.86, 13.36, "KH"],
    guam: [144.79, 13.44, "GU"], honolulu: [-157.86, 21.31, "US"], sydney: [151.21, -33.87, "AU"], cairns: [145.77, -16.92, "AU"],
    melbourne: [144.96, -37.81, "AU"], auckland: [174.76, -36.85, "NZ"], newyork: [-74.01, 40.71, "US"], la: [-118.24, 34.05, "US"],
    sanfrancisco: [-122.42, 37.77, "US"], lasvegas: [-115.14, 36.17, "US"], vancouver: [-123.12, 49.28, "CA"],
    london: [-0.13, 51.51, "GB"], paris: [2.35, 48.86, "FR"], rome: [12.5, 41.9, "IT"], barcelona: [2.17, 41.39, "ES"],
    amsterdam: [4.9, 52.37, "NL"], prague: [14.42, 50.08, "CZ"], helsinki: [24.94, 60.17, "FI"], istanbul: [28.98, 41.01, "TR"],
    dubai: [55.27, 25.2, "AE"], doha: [51.53, 25.29, "QA"], frankfurt: [8.68, 50.11, "DE"],
    // 2026年10月に追加した都市
    manila: [120.98, 14.6, "PH"], boracay: [121.92, 11.97, "PH"], phuket: [98.39, 7.88, "TH"], chiangmai: [98.99, 18.79, "TH"],
    samui: [100.06, 9.51, "TH"], penang: [100.33, 5.41, "MY"], kotakinabalu: [116.07, 5.98, "MY"], langkawi: [99.84, 6.35, "MY"],
    luangprabang: [102.13, 19.89, "LA"], phnompenh: [104.92, 11.56, "KH"], chengdu: [104.07, 30.57, "CN"], xian: [108.94, 34.34, "CN"],
    guangzhou: [113.26, 23.13, "CN"], kaohsiung: [120.31, 22.63, "TW"], tainan: [120.21, 22.99, "TW"], macau: [113.54, 22.2, "MO"],
    maldives: [73.51, 4.18, "MV"], delhi: [77.21, 28.61, "IN"], kathmandu: [85.32, 27.72, "NP"],
    goldcoast: [153.43, -28.0, "AU"], perth: [115.86, -31.95, "AU"], queenstown: [168.66, -45.03, "NZ"], saipan: [145.75, 15.18, "MP"],
    palau: [134.62, 7.5, "PW"], tahiti: [-149.57, -17.65, "PF"], maui: [-156.33, 20.8, "US"],
    seattle: [-122.33, 47.61, "US"], chicago: [-87.63, 41.88, "US"], boston: [-71.06, 42.36, "US"], washingtondc: [-77.04, 38.91, "US"],
    sandiego: [-117.16, 32.72, "US"], orlando: [-81.38, 28.54, "US"], toronto: [-79.38, 43.65, "CA"], banff: [-115.57, 51.18, "CA"],
    cancun: [-86.85, 21.16, "MX"], mexicocity: [-99.13, 19.43, "MX"], lima: [-77.04, -12.05, "PE"], rio: [-43.17, -22.91, "BR"],
    buenosaires: [-58.38, -34.6, "AR"],
    lisbon: [-9.14, 38.72, "PT"], madrid: [-3.7, 40.42, "ES"], berlin: [13.4, 52.52, "DE"], munich: [11.58, 48.14, "DE"],
    vienna: [16.37, 48.21, "AT"], budapest: [19.04, 47.5, "HU"], brussels: [4.35, 50.85, "BE"], zurich: [8.54, 47.38, "CH"],
    milan: [9.19, 45.46, "IT"], florence: [11.26, 43.77, "IT"], venice: [12.33, 45.44, "IT"], athens: [23.73, 37.98, "GR"],
    santorini: [25.43, 36.39, "GR"], copenhagen: [12.57, 55.68, "DK"], stockholm: [18.07, 59.33, "SE"], oslo: [10.75, 59.91, "NO"],
    dublin: [-6.26, 53.35, "IE"], edinburgh: [-3.19, 55.95, "GB"], reykjavik: [-21.94, 64.15, "IS"], dubrovnik: [18.09, 42.65, "HR"],
    krakow: [19.94, 50.06, "PL"], abudhabi: [54.37, 24.45, "AE"], cairo: [31.24, 30.04, "EG"], marrakech: [-8.0, 31.63, "MA"],
    capetown: [18.42, -33.92, "ZA"]
  };
  var PLACES = D.TO.concat(D.HUBS || []).filter(function (c) { return CITY_POS[c.id]; }).map(function (c) {
    var p = CITY_POS[c.id];
    return { id: c.id, name: c.name, g: c.g || "乗り継ぎでよく使う都市", lon: p[0], lat: p[1], cc: p[2] };
  });

  // 地図データの国ID（ISO 3166-1 の数字コード）→ 2文字コード。国名は日本語に変換して表示する
  var ISO = {};
  ("004AF 008AL 010AQ 012DZ 024AO 031AZ 032AR 036AU 040AT 044BS 050BD 051AM 056BE 064BT 068BO 070BA 072BW 076BR 084BZ 090SB " +
   "096BN 100BG 104MM 108BI 112BY 116KH 120CM 124CA 140CF 144LK 148TD 152CL 156CN 158TW 170CO 178CG 180CD 188CR 191HR 192CU " +
   "196CY 203CZ 204BJ 208DK 214DO 218EC 222SV 226GQ 231ET 232ER 233EE 238FK 242FJ 246FI 250FR 260TF 262DJ 266GA 268GE 270GM " +
   "275PS 276DE 288GH 300GR 304GL 320GT 324GN 328GY 332HT 340HN 348HU 352IS 356IN 360ID 364IR 368IQ 372IE 376IL 380IT 384CI " +
   "388JM 392JP 398KZ 400JO 404KE 408KP 410KR 414KW 417KG 418LA 422LB 426LS 428LV 430LR 434LY 440LT 442LU 450MG 454MW 458MY " +
   "466ML 478MR 484MX 496MN 498MD 499ME 504MA 508MZ 512OM 516NA 524NP 528NL 540NC 548VU 554NZ 558NI 562NE 566NG 578NO 586PK " +
   "591PA 598PG 600PY 604PE 608PH 616PL 620PT 624GW 626TL 630PR 634QA 642RO 643RU 646RW 682SA 686SN 688RS 694SL 703SK 704VN " +
   "705SI 706SO 710ZA 716ZW 724ES 728SS 729SD 732EH 740SR 748SZ 752SE 756CH 760SY 762TJ 764TH 768TG 780TT 784AE 788TN 792TR " +
   "795TM 800UG 804UA 807MK 818EG 826GB 834TZ 840US 854BF 858UY 860UZ 862VE 887YE 894ZM").split(" ").forEach(function (s) {
    ISO[s.slice(0, 3)] = s.slice(3);
  });
  var DN = null;
  try { DN = new Intl.DisplayNames(["ja"], { type: "region" }); } catch (e) { DN = null; }
  function ccName(cc) { if (!cc) return ""; try { return DN ? DN.of(cc) : cc; } catch (e) { return cc; } }
  function pad(id) { return String(id).padStart(3, "0"); }

  // ===== 保存（IndexedDB）=====
  var db = null;
  function openDB() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error("no indexedDB")); return; }
      var r = indexedDB.open("tabi-map", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("photos", { keyPath: "id" }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function done(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function store(mode) { return db.transaction("photos", mode).objectStore("photos"); }
  function getAll() { return done(store("readonly").getAll()); }
  function putPhoto(p) { return done(store("readwrite").put(p)); }
  function deletePhoto(id) { return done(store("readwrite").delete(id)); }

  // ===== 状態 =====
  var photos = [], thumbs = {}, features = [], queue = [], pick = null, filterKey = null;
  var proj = window.d3 ? d3.geoNaturalEarth1() : null, path = window.d3 ? d3.geoPath(proj) : null;
  var svg = null, gRoot = null, gCountries = null, gPins = null, gPick = null, zoom = null, zoomK = 1;

  function setStatus(msg, isErr) { var el = $("status"); el.textContent = msg; el.classList.toggle("err", !!isErr); }
  function setBackup(msg, isErr) { var el = $("backupStatus"); el.textContent = msg; el.classList.toggle("err", !!isErr); }
  function whereMode() { var el = document.querySelector('input[name="where"]:checked'); return el ? el.value : "gps"; }
  function keyOf(p) { return p.name + "|" + p.lat.toFixed(1) + "|" + p.lon.toFixed(1); }
  function groupsOf(list) {
    var m = {}, order = [];
    list.forEach(function (p) {
      var k = keyOf(p);
      if (!m[k]) { m[k] = { key: k, name: p.name, lat: p.lat, lon: p.lon, items: [] }; order.push(k); }
      m[k].items.push(p);
    });
    return order.map(function (k) { return m[k]; });
  }

  // ===== 地図 =====
  function featureName(f) { var cc = ISO[pad(f.id)]; return cc ? ccName(cc) : (f.properties && f.properties.name) || ""; }
  function countryAt(lon, lat) {
    for (var i = 0; i < features.length; i++) if (d3.geoContains(features[i], [lon, lat])) return features[i];
    return null;
  }
  // 国境線のデータは簡略化されているので、海岸ぎりぎりの地点は約190km以内でいちばん近い国にする
  function countryNear(lon, lat) {
    var f = countryAt(lon, lat);
    if (f) return f;
    var best = null, bd = 0.03;
    features.forEach(function (ft) {
      (function walk(c) {
        if (typeof c[0] === "number") { var d = d3.geoDistance([lon, lat], c); if (d < bd) { bd = d; best = ft; } }
        else c.forEach(walk);
      })(ft.geometry.coordinates);
    });
    return best;
  }
  function xy(d) { return proj([d.lon, d.lat]); }

  function initMap() {
    svg = d3.select("#map").attr("viewBox", "0 0 " + W + " " + H);
    gRoot = svg.append("g");
    proj.fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" });
    gRoot.append("path").datum({ type: "Sphere" }).attr("class", "sphere").attr("d", path);
    gRoot.append("path").datum(d3.geoGraticule10()).attr("class", "graticule").attr("d", path);
    gCountries = gRoot.append("g");
    gPins = gRoot.append("g");
    gPick = gRoot.append("g");
    zoom = d3.zoom().scaleExtent([1, 12]).translateExtent([[0, 0], [W, H]]).on("zoom", function (e) {
      zoomK = e.transform.k;
      gRoot.attr("transform", e.transform);
      sizeMarks();
    });
    svg.call(zoom);
    svg.on("click", function (e) {
      if (whereMode() !== "map") return;
      var ll = proj.invert(d3.pointer(e, gRoot.node()));
      if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) return;
      var f = countryNear(ll[0], ll[1]);
      pick ={ lon: ll[0], lat: ll[1], cc: f ? ISO[pad(f.id)] || "" : "", country: f ? featureName(f) : "" };
      drawPick();
      updatePickInfo();
    });
    return fetch(WORLD_URL).then(function (r) { return r.json(); }).then(function (topo) {
      features = topojson.feature(topo, topo.objects.countries).features;
      gCountries.selectAll("path").data(features).join("path").attr("class", "country").attr("d", path);
      $("mapLoading").hidden = true;
    });
  }

  function drawPins() {
    if (!gPins) return;
    var gs = groupsOf(photos), visited = {};
    photos.forEach(function (p) { if (p.cc) visited[p.cc] = 1; });
    gCountries.selectAll("path").classed("visited", function (f) { return !!visited[ISO[pad(f.id)]]; });
    gPins.selectAll("circle").data(gs, function (g) { return g.key; }).join("circle")
      .attr("class", function (g) { return "pin" + (g.key === filterKey ? " active" : ""); })
      .attr("cx", function (g) { return xy(g)[0]; })
      .attr("cy", function (g) { return xy(g)[1]; })
      .attr("tabindex", 0)
      .attr("aria-label", function (g) { return g.name + "の写真 " + g.items.length + "枚"; })
      .on("mouseenter", showTip).on("mousemove", showTip).on("mouseleave", hideTip)
      .on("focus", function (e, g) { showTip(e, g); }).on("blur", hideTip)
      .on("click", function (e, g) {
        e.stopPropagation();
        filterKey = filterKey === g.key ? null : g.key;
        drawPins();
        renderGallery();
        $("gallerySec").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .on("keydown", function (e, g) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.dispatchEvent(new MouseEvent("click")); } });
    sizeMarks();
  }
  function pinR(g) { return 4 + Math.min(g.items.length, 12) * 0.5; }
  function sizeMarks() {
    if (!gRoot) return;
    gPins.selectAll("circle").attr("r", function (g) { return pinR(g) / zoomK; }).attr("stroke-width", 1.5 / zoomK);
    gPick.selectAll("circle").attr("r", 9 / zoomK).attr("stroke-width", 2 / zoomK);
    gCountries.selectAll("path").attr("stroke-width", 0.5 / zoomK);
  }
  function drawPick() {
    if (!gPick) return;
    gPick.selectAll("circle").data(pick && whereMode() === "map" ? [pick] : []).join("circle")
      .attr("class", "pick-mark").attr("cx", function (d) { return xy(d)[0]; }).attr("cy", function (d) { return xy(d)[1]; });
    sizeMarks();
  }
  function showTip(e, g) {
    var box = $("mapBox").getBoundingClientRect(), tip = $("mapTip"), th = thumbs[g.items[0].id];
    var r = e.clientX != null && e.type !== "focus" ? { x: e.clientX, y: e.clientY } : (function (rc) { return { x: rc.left + rc.width / 2, y: rc.top }; })(e.target.getBoundingClientRect());
    tip.innerHTML = (th ? '<img src="' + th + '" alt="">' : "") + "<span><b>" + esc(g.name) + "</b><br>写真" + g.items.length + "枚</span>";
    tip.style.left = (r.x - box.left) + "px";
    tip.style.top = (r.y - box.top) + "px";
    tip.hidden = false;
  }
  function hideTip() { $("mapTip").hidden = true; }

  // 地図を画像（PNG）で保存する
  function exportMap() {
    if (!features.length) return;
    var cs = getComputedStyle(document.documentElement);
    var col = function (v) { return cs.getPropertyValue(v).trim(); };
    var stats = $("statCountries").textContent + "の国・地域　" + $("statPlaces").textContent + "か所　写真" + $("statPhotos").textContent + "枚";
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 960 540">',
      '<rect width="960" height="540" fill="' + col("--paper") + '"/>',
      '<text x="24" y="30" font-family="sans-serif" font-size="18" font-weight="700" fill="' + col("--ink") + '">わたしの旅の世界地図</text>',
      '<text x="936" y="30" text-anchor="end" font-family="sans-serif" font-size="13" fill="' + col("--ink-2") + '">' + esc(stats) + "</text>",
      '<g transform="translate(0,40)">',
      '<path d="' + path({ type: "Sphere" }) + '" fill="' + col("--accent-soft") + '"/>'];
    gCountries.selectAll("path").each(function (f) {
      var on = this.classList.contains("visited");
      out.push('<path d="' + this.getAttribute("d") + '" fill="' + col(on ? "--accent" : "--line") + '" stroke="' + col("--paper") + '" stroke-width="0.5"/>');
    });
    groupsOf(photos).forEach(function (g) {
      var p = xy(g);
      out.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + pinR(g) + '" fill="' + col("--s2") + '" stroke="' + col("--paper") + '" stroke-width="1.5"/>');
    });
    out.push("</g>", '<text x="936" y="530" text-anchor="end" font-family="sans-serif" font-size="10" fill="' + col("--muted") + '">海外旅行予算ナビ</text>', "</svg>");
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = 1920; c.height = 1080;
      c.getContext("2d").drawImage(img, 0, 0, 1920, 1080);
      c.toBlob(function (b) { if (b) download(b, "my-travel-map.png"); }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(out.join(""));
  }

  // ===== 一覧（ギャラリー）=====
  function placeSub(p) {
    var c = p.cc ? ccName(p.cc) : "";
    return [c && c !== p.name ? c : "", p.date ? jaDate(p.date) : ""].filter(Boolean).join("・");
  }
  function renderGallery() {
    var list = photos.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || "") || b.created - a.created; });
    var first = null;
    if (filterKey) {
      list = list.filter(function (p) { return keyOf(p) === filterKey; });
      first = list[0];
      if (!first) filterKey = null;
    }
    if (!filterKey) list = photos.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || "") || b.created - a.created; });
    $("galTitle").textContent = filterKey ? first.name + "の写真（" + list.length + "枚）" : "すべての写真（" + photos.length + "枚）";
    $("showAll").hidden = !filterKey;
    $("empty").hidden = photos.length > 0;
    $("gallery").innerHTML = list.map(function (p) {
      return '<button type="button" class="gcard" data-id="' + esc(p.id) + '"><img src="' + (thumbs[p.id] || "") + '" alt="' + esc(p.name) + 'の写真" loading="lazy">' +
        '<span class="cap"><b>' + esc(p.name) + "</b>" + (placeSub(p) ? "<small>" + esc(placeSub(p)) + "</small>" : "") +
        (p.memo ? "<small>" + esc(p.memo.length > 40 ? p.memo.slice(0, 40) + "…" : p.memo) + "</small>" : "") + "</span></button>";
    }).join("");
  }
  function renderStats() {
    var cc = {};
    photos.forEach(function (p) { if (p.cc) cc[p.cc] = 1; });
    $("statCountries").textContent = Object.keys(cc).length;
    $("statPlaces").textContent = groupsOf(photos).length;
    $("statPhotos").textContent = photos.length;
  }
  function updateUsage() {
    if (!navigator.storage || !navigator.storage.estimate) return;
    navigator.storage.estimate().then(function (e) {
      $("usage").textContent = "この端末で使っている容量：約" + Math.max(0.1, Math.round((e.usage || 0) / 1048576 * 10) / 10) + "MB";
    }).catch(function () {});
  }
  function refresh() { renderStats(); drawPins(); renderGallery(); updateUsage(); }

  // ===== 写真の追加 =====
  function readMeta(file) {
    var item = { file: file, url: URL.createObjectURL(file), gps: null, date: "" };
    if (!window.exifr) return Promise.resolve(item);
    return Promise.all([
      exifr.gps(file).catch(function () { return null; }),
      exifr.parse(file, ["DateTimeOriginal"]).catch(function () { return null; })
    ]).then(function (r) {
      if (r[0] && isFinite(r[0].latitude) && isFinite(r[0].longitude)) item.gps = { lat: r[0].latitude, lon: r[0].longitude };
      var dt = r[1] && r[1].DateTimeOriginal;
      if (dt instanceof Date && !isNaN(dt)) item.date = fmtDate(dt);
      return item;
    });
  }
  function addFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name); });
    if (!list.length) { setStatus("画像ファイルを選んでください。", true); return; }
    setStatus("写真の情報を読み取っています…");
    Promise.all(list.map(readMeta)).then(function (items) {
      queue = queue.concat(items);
      renderQueue();
      updatePickInfo();
      var withGps = items.filter(function (q) { return q.gps; }).length;
      if (withGps && whereMode() !== "gps") setRadio("gps");
      if (!withGps && whereMode() === "gps") setRadio("city");
      setStatus(items.length + "枚を選びました。場所を確認して「地図に追加する」を押してください。");
    });
  }
  function renderQueue() {
    $("queue").innerHTML = queue.map(function (q) {
      return '<div class="qitem"><img src="' + q.url + '" alt=""><span>' + (q.gps ? "位置情報あり" : "位置情報なし") + "</span></div>";
    }).join("");
    $("saveBtn").disabled = !queue.length;
  }
  function setRadio(v) {
    var el = document.querySelector('input[name="where"][value="' + v + '"]');
    if (el) { el.checked = true; onWhereChange(); }
  }
  function onWhereChange() {
    var m = whereMode();
    $("city").hidden = m !== "city";
    $("mapBox").classList.toggle("picking", m === "map");
    $("pickHint").hidden = m !== "map";
    drawPick();
    updatePickInfo();
    if (m === "map") $("mapBox").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function updatePickInfo() {
    var m = whereMode(), t;
    if (m === "gps") {
      var withG = queue.filter(function (q) { return q.gps; }).length, without = queue.length - withG;
      t = queue.length
        ? "位置情報がある写真：" + withG + "枚、ない写真：" + without + "枚" + (without ? "（ない写真は「都市から選ぶ」か「地図で選ぶ」に切り替えて追加してください）" : "")
        : "写真に記録された位置情報（GPS）から、撮った場所を自動で決めます。";
    } else if (m === "city") {
      t = "予算ナビの都市から選びます。";
    } else {
      t = pick ? "選んだ場所：" + (pick.country || "海の上") + "（緯度" + pick.lat.toFixed(2) + "、経度" + pick.lon.toFixed(2) + "）"
        : "上の地図をクリック（タップ）して、写真を撮った場所を選んでください。";
    }
    $("pickInfo").textContent = t;
  }
  function loadImage(url) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error("decode")); };
      img.src = url;
    });
  }
  function scaleTo(img, max, q) {
    var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise(function (res, rej) { c.toBlob(function (b) { if (b) res(b); else rej(new Error("encode")); }, "image/jpeg", q); });
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  async function save(e) {
    e.preventDefault();
    if (!db) { setStatus("このブラウザでは写真を保存できません。プライベートブラウズを解除するか、別のブラウザで開いてください。", true); return; }
    if (!queue.length) { setStatus("先に写真を選んでください。", true); return; }
    if (!features.length) { setStatus("地図の読み込みが終わってから追加してください。", true); return; }
    var m = whereMode(), base = null;
    if (m === "city") {
      var c = PLACES.find(function (x) { return x.id === $("city").value; });
      base = { lat: c.lat, lon: c.lon, cc: c.cc, name: c.name };
    } else if (m === "map") {
      if (!pick) { setStatus("地図をクリックして、写真を撮った場所を選んでください。", true); return; }
      base = { lat: pick.lat, lon: pick.lon, cc: pick.cc, name: pick.country || "海の上" };
    }
    var typed = $("placeName").value.trim(), dateIn = $("shotDate").value, memo = $("memo").value.trim();
    $("saveBtn").disabled = true;
    setStatus("保存しています…");
    var saved = 0, noGps = 0, broken = 0, left = [];
    for (var i = 0; i < queue.length; i++) {
      var q = queue[i], loc = base;
      if (m === "gps") {
        if (!q.gps) { noGps++; left.push(q); continue; }
        var f = countryNear(q.gps.lon, q.gps.lat);
        loc ={ lat: q.gps.lat, lon: q.gps.lon, cc: f ? ISO[pad(f.id)] || "" : "", name: f ? featureName(f) : "海の上" };
      }
      try {
        var img = await loadImage(q.url);
        var full = await scaleTo(img, 1600, 0.82), thumb = await scaleTo(img, 400, 0.78);
        var rec = { id: newId(), name: typed || loc.name, lat: loc.lat, lon: loc.lon, cc: loc.cc, date: dateIn || q.date || "",
          memo: memo, blob: full, thumb: thumb, created: Date.now() };
        await putPhoto(rec);
        photos.push(rec);
        thumbs[rec.id] = URL.createObjectURL(thumb);
        URL.revokeObjectURL(q.url);
        saved++;
      } catch (err) { broken++; URL.revokeObjectURL(q.url); }
    }
    queue = left;
    renderQueue();
    refresh();
    var msg = [];
    if (saved) msg.push(saved + "枚を地図に追加しました。");
    if (noGps) msg.push("位置情報がない" + noGps + "枚は残しています。「都市から選ぶ」か「地図で選ぶ」に切り替えて追加してください。");
    if (broken) msg.push(broken + "枚は読み込めませんでした（HEIC形式などはJPEGに変換してから追加してください）。");
    setStatus(msg.join(""), !saved);
    if (saved && !queue.length) { $("placeName").value = ""; $("memo").value = ""; $("shotDate").value = ""; }
  }

  // ===== 写真の拡大表示 =====
  var lbId = null, lbUrl = null, delArmed = false;
  function openLB(id) {
    var p = photos.find(function (x) { return x.id === id; });
    if (!p) return;
    lbId = id;
    lbUrl = URL.createObjectURL(p.blob);
    $("lbImg").src = lbUrl;
    $("lbImg").alt = p.name + "の写真";
    $("lbTitle").textContent = p.name;
    $("lbMeta").textContent = placeSub(p);
    $("lbMemo").textContent = p.memo || "";
    delArmed = false;
    $("lbDelete").textContent = "削除";
    $("lightbox").hidden = false;
    $("lbClose").focus();
  }
  function closeLB() {
    $("lightbox").hidden = true;
    if (lbUrl) URL.revokeObjectURL(lbUrl);
    lbUrl = null; lbId = null;
  }
  function deleteCurrent() {
    if (!delArmed) { delArmed = true; $("lbDelete").textContent = "本当に削除する"; return; }
    var id = lbId;
    deletePhoto(id).then(function () {
      if (thumbs[id]) URL.revokeObjectURL(thumbs[id]);
      delete thumbs[id];
      photos = photos.filter(function (p) { return p.id !== id; });
      closeLB();
      refresh();
      setStatus("写真を1枚削除しました。");
    });
  }

  // ===== バックアップ =====
  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function toDataURL(b) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(b);
    });
  }
  async function exportBackup() {
    if (!photos.length) { setBackup("保存する写真がまだありません。", true); return; }
    setBackup("バックアップを作っています…");
    var out = [];
    for (var i = 0; i < photos.length; i++) {
      var p = photos[i];
      out.push({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, cc: p.cc, date: p.date, memo: p.memo, created: p.created,
        image: await toDataURL(p.blob), thumb: await toDataURL(p.thumb) });
    }
    var blob = new Blob([JSON.stringify({ app: "tabi-map", version: 1, exported: new Date().toISOString(), photos: out })], { type: "application/json" });
    download(blob, "tabi-map-backup-" + fmtDate(new Date()).replace(/-/g, "") + ".json");
    setBackup(photos.length + "枚分のバックアップを保存しました。");
  }
  async function importBackup(file) {
    if (!db) { setBackup("このブラウザでは写真を保存できません。", true); return; }
    setBackup("復元しています…");
    try {
      var data = JSON.parse(await file.text());
      if (!data || data.app !== "tabi-map" || !Array.isArray(data.photos)) throw new Error("format");
      var have = {}, n = 0;
      photos.forEach(function (p) { have[p.id] = 1; });
      for (var i = 0; i < data.photos.length; i++) {
        var o = data.photos[i];
        if (have[o.id] || !o.image || !o.thumb) continue;
        var rec = { id: String(o.id), name: String(o.name || "場所"), lat: +o.lat, lon: +o.lon, cc: o.cc || "", date: o.date || "",
          memo: o.memo || "", created: o.created || Date.now(),
          blob: await (await fetch(o.image)).blob(), thumb: await (await fetch(o.thumb)).blob() };
        await putPhoto(rec);
        photos.push(rec);
        thumbs[rec.id] = URL.createObjectURL(rec.thumb);
        n++;
      }
      refresh();
      var skipped = data.photos.length - n;
      setBackup(n + "枚を復元しました。" + (skipped ? "すでにある" + skipped + "枚は飛ばしました。" : ""));
    } catch (err) {
      setBackup("このファイルは読み込めませんでした。このページの「バックアップを保存」で作ったファイルを選んでください。", true);
    }
  }

  // ===== 初期化 =====
  (function fillCities() {
    var sel = $("city"), groups = {};
    PLACES.forEach(function (p) {
      if (!groups[p.g]) { groups[p.g] = document.createElement("optgroup"); groups[p.g].label = p.g; sel.appendChild(groups[p.g]); }
      groups[p.g].appendChild(new Option(p.name, p.id));
    });
  })();

  document.querySelectorAll('input[name="where"]').forEach(function (el) { el.addEventListener("change", onWhereChange); });
  $("files").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  $("addForm").addEventListener("submit", save);
  $("gallery").addEventListener("click", function (e) { var b = e.target.closest(".gcard"); if (b) openLB(b.dataset.id); });
  $("showAll").addEventListener("click", function () { filterKey = null; drawPins(); renderGallery(); });
  $("lbClose").addEventListener("click", closeLB);
  $("lbDelete").addEventListener("click", deleteCurrent);
  $("lightbox").addEventListener("click", function (e) { if (e.target === $("lightbox")) closeLB(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("lightbox").hidden) closeLB(); });
  $("resetView").addEventListener("click", function () { if (svg && zoom) svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity); });
  $("saveImage").addEventListener("click", exportMap);
  $("exportBtn").addEventListener("click", exportBackup);
  $("importFile").addEventListener("change", function (e) { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; });

  renderQueue();
  onWhereChange();
  openDB().then(function (d) {
    db = d;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    return getAll().then(function (list) {
      photos = list;
      list.forEach(function (p) { thumbs[p.id] = URL.createObjectURL(p.thumb); });
    });
  }).catch(function () {
    setStatus("このブラウザでは写真を保存できません（プライベートブラウズなど）。別のブラウザで開いてください。", true);
  }).then(function () {
    if (!window.d3 || !window.topojson) throw new Error("lib");
    return initMap();
  }).catch(function () {
    $("mapLoading").textContent = "地図を読み込めませんでした。インターネット接続を確認して、ページを再読み込みしてください。";
  }).then(refresh);
})();
