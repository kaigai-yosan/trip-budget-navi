// 背景：行き先ごとのランドマークをCanvasで描く
// 描画座標は横1000・下端0で上向きが正。a=画面左端、b=画面右端（仮想座標）
(function () {
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function P(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function R(c, x, y, w, h) { c.fillRect(x, y, w, h); }
  function C(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function E(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  function cut(c, fn) { c.save(); c.globalCompositeOperation = "destination-out"; fn(); c.restore(); }
  function arch(c, x, y, w, h) { R(c, x, y, w, h - w / 2); c.beginPath(); c.arc(x + w / 2, y + h - w / 2, w / 2, 0, Math.PI); c.fill(); }
  function skyline(c, x0, x1, lo, hi, seed, wl, wh) {
    var r = rng(seed), x = x0; wl = wl || 18; wh = wh || 46;
    while (x < x1) {
      var w = wl + r() * (wh - wl), h = lo + r() * (hi - lo);
      R(c, x, 0, w + 0.5, h);
      if (r() > 0.85) R(c, x + w / 2 - 1, h, 2, 22);
      x += w;
    }
  }
  function hills(c, x0, x1, base, amp, seed, freq) {
    var r = rng(seed), p1 = r() * 6, p2 = r() * 6, f = freq || 1;
    c.beginPath(); c.moveTo(x0, 0);
    for (var x = x0; x <= x1 + 10; x += 10) c.lineTo(x, base + amp * (0.6 * Math.sin(x / 130 * f + p1) + 0.4 * Math.sin(x / 47 * f + p2)));
    c.lineTo(x1 + 10, 0); c.closePath(); c.fill();
  }
  function peaks(c, pts) {
    c.beginPath(); c.moveTo(pts[0][0], 0);
    pts.forEach(function (p) { c.lineTo(p[0], p[1]); });
    c.lineTo(pts[pts.length - 1][0], 0); c.closePath(); c.fill();
  }
  function palm(c, x, h, lean, crown) {
    var tx = x + lean, ty = h, L = crown || h * 0.32;
    c.beginPath(); c.moveTo(x - 5, 0); c.quadraticCurveTo(x + lean * 0.2 - 4, h * 0.5, tx - 2, ty);
    c.lineTo(tx + 2, ty); c.quadraticCurveTo(x + lean * 0.2 + 4, h * 0.5, x + 5, 0); c.closePath(); c.fill();
    [0.25, 0.85, 1.6, 2.3, 2.9, -0.35].forEach(function (a) {
      var ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 - L * 0.35;
      var nx = -Math.sin(a) * 9, ny = Math.cos(a) * 9;
      c.beginPath(); c.moveTo(tx, ty);
      c.quadraticCurveTo((tx + ex) / 2 + nx, (ty + ey) / 2 + L * 0.3 + ny, ex, ey);
      c.quadraticCurveTo((tx + ex) / 2 - nx * 0.3, (ty + ey) / 2 + L * 0.15, tx, ty - 3);
      c.fill();
    });
  }
  function roof(c, x, w, y, h) { // 反り屋根
    c.beginPath(); c.moveTo(x - w / 2 - 18, y + 6);
    c.quadraticCurveTo(x - w / 2 + 10, y + 2, x - w / 2 + 14, y + h * 0.5);
    c.lineTo(x - w * 0.3, y + h); c.lineTo(x + w * 0.3, y + h); c.lineTo(x + w / 2 - 14, y + h * 0.5);
    c.quadraticCurveTo(x + w / 2 - 10, y + 2, x + w / 2 + 18, y + 6); c.closePath(); c.fill();
  }
  function spire(c, x, w, h) { P(c, [[x - w / 2, 0], [x - w / 2, h * 0.6], [x - w * 0.3, h * 0.62], [x, h], [x + w * 0.3, h * 0.62], [x + w / 2, h * 0.6], [x + w / 2, 0]]); }
  function prang(c, x, w, h) { // タイの仏塔
    var n = 7, y = 0;
    for (var i = 0; i < n; i++) { var ww = w * (1 - i / (n + 1.5)), hh = h * 0.6 / n; R(c, x - ww / 2, y, ww, hh); y += hh; }
    P(c, [[x - w * 0.18, y], [x + w * 0.18, y], [x + 2, h], [x - 2, h]]);
  }

  // h/h2=空の色相（上/地平線）、water=水面の高さ、sun=太陽・月の位置
  var SCENES = {
    seoul: { cap: "Nソウルタワーと景福宮", h: 205, h2: 30, sun: [820, 300],
      far: function (c, a, b) { peaks(c, [[a, 80], [60, 150], [140, 110], [220, 190], [300, 130], [380, 170], [470, 100], [560, 140], [700, 90], [800, 150], [900, 110], [b, 130]]); },
      near: function (c, a, b) {
        skyline(c, a, b, 30, 90, 11);
        P(c, [[460, 0], [560, 120], [650, 165], [740, 120], [860, 0]]);
        R(c, 645, 150, 10, 150); E(c, 650, 305, 24, 13); R(c, 643, 290, 14, 30); R(c, 649, 318, 2, 60);
        R(c, 170, 0, 170, 70); roof(c, 255, 200, 70, 40); R(c, 195, 110, 120, 20); roof(c, 255, 150, 128, 30);
      } },
    busan: { cap: "広安大橋と甘川洞文化村", h: 200, h2: 190, water: 60, sun: [180, 290],
      far: function (c, a, b) { hills(c, a, b, 150, 40, 3); },
      near: function (c, a, b) {
        var r = rng(7);
        for (var i = 0; i < 40; i++) { var x = 40 + r() * 320; R(c, x, 0, 14, 90 + r() * 70 - Math.abs(x - 200) * 0.3); }
        R(c, a, 60, b - a, 6);
        [420, 680].forEach(function (x) {
          R(c, x - 6, 60, 12, 160);
          c.lineWidth = 1.6; c.beginPath();
          for (var k = 1; k <= 7; k++) { c.moveTo(x, 214 - k * 6); c.lineTo(x - k * 30, 64); c.moveTo(x, 214 - k * 6); c.lineTo(x + k * 30, 64); }
          c.stroke();
        });
      } },
    taipei: { cap: "台北101と龍山寺", h: 160, h2: 40, sun: [200, 300],
      far: function (c, a, b) { hills(c, a, b, 130, 45, 5); },
      near: function (c, a, b) {
        skyline(c, a, b, 25, 80, 21);
        R(c, 612, 0, 56, 90);
        for (var i = 0; i < 8; i++) P(c, [[618, 90 + i * 30], [662, 90 + i * 30], [670, 120 + i * 30], [610, 120 + i * 30]]);
        R(c, 628, 330, 24, 22); R(c, 634, 352, 12, 14); R(c, 639, 366, 2, 34);
        R(c, 150, 0, 160, 60); roof(c, 230, 190, 60, 36); R(c, 175, 96, 110, 22); roof(c, 230, 140, 118, 30);
      } },
    hongkong: { cap: "ビクトリア・ハーバーとジャンク船", h: 215, h2: 280, water: 55, sun: [880, 320],
      far: function (c, a, b) { hills(c, a, b, 190, 50, 9, 0.8); },
      near: function (c, a, b) {
        skyline(c, 360, b, 60, 170, 31, 14, 34);
        R(c, 420, 0, 40, 300); P(c, [[420, 300], [440, 320], [460, 300]]); R(c, 438, 320, 4, 30);
        P(c, [[560, 0], [560, 230], [580, 280], [600, 260], [610, 290], [620, 0]]); R(c, 584, 280, 2, 60); R(c, 604, 290, 2, 50);
        P(c, [[160, 58], [300, 58], [285, 40], [175, 40]]);
        c.beginPath(); c.moveTo(200, 62); c.quadraticCurveTo(170, 140, 205, 190); c.lineTo(240, 62); c.fill();
        c.beginPath(); c.moveTo(245, 62); c.quadraticCurveTo(225, 120, 250, 160); c.lineTo(282, 62); c.fill();
      } },
    shanghai: { cap: "外灘から見る浦東の摩天楼", h: 25, h2: 200, water: 50, sun: [140, 300],
      far: function (c, a, b) { skyline(c, a, b, 40, 130, 41, 20, 50); },
      near: function (c, a, b) {
        c.lineWidth = 7; c.beginPath(); c.moveTo(270, 0); c.lineTo(300, 120); c.moveTo(330, 0); c.lineTo(300, 120); c.stroke();
        R(c, 295, 0, 10, 380); C(c, 300, 140, 40); C(c, 300, 260, 24); C(c, 300, 330, 9); R(c, 299, 340, 2, 50);
        P(c, [[560, 0], [566, 300], [600, 375], [616, 340], [640, 0]]);
        R(c, 690, 0, 44, 320);
        cut(c, function () { P(c, [[700, 280], [724, 280], [718, 306], [706, 306]]); });
        R(c, 760, 0, 40, 250); P(c, [[760, 250], [780, 280], [800, 250]]);
        skyline(c, 820, b, 40, 120, 43);
        skyline(c, a, 260, 30, 90, 45);
      } },
    bangkok: { cap: "ワット・アルン（暁の寺）", h: 30, h2: 45, water: 45, sun: [800, 310],
      far: function (c, a, b) { skyline(c, a, b, 40, 140, 51, 20, 50); },
      near: function (c, a, b) {
        R(c, 330, 0, 340, 50);
        prang(c, 500, 150, 330); prang(c, 380, 70, 170); prang(c, 620, 70, 170);
        palm(c, 160, 190, -20); palm(c, 230, 150, 15); palm(c, 860, 200, 25);
        P(c, [[700, 50], [820, 50], [840, 64], [690, 62]]);
      } },
    hcm: { cap: "サイゴン大教会とビテクスコ・タワー", h: 25, h2: 340, sun: [180, 290],
      far: function (c, a, b) { skyline(c, a, b, 40, 120, 61); },
      near: function (c, a, b) {
        P(c, [[625, 0], [640, 330], [652, 370], [662, 330], [680, 0]]); E(c, 668, 250, 34, 6);
        R(c, 240, 0, 140, 110); spire(c, 260, 34, 250); spire(c, 360, 34, 250); P(c, [[240, 110], [310, 150], [380, 110]]);
        cut(c, function () { arch(c, 296, 0, 28, 60); C(c, 310, 90, 10); });
        palm(c, 120, 170, 18); palm(c, 860, 180, -15);
      } },
    danang: { cap: "ドラゴン・ブリッジと五行山", h: 195, h2: 25, water: 55, sun: [820, 300],
      far: function (c, a, b) { hills(c, a, b, 80, 20, 13); E(c, 150, 90, 60, 80); E(c, 250, 70, 45, 60); },
      near: function (c, a, b) {
        R(c, a, 70, b - a, 6);
        c.lineWidth = 12; c.beginPath(); c.moveTo(150, 90);
        for (var x = 150; x <= 850; x += 5) c.lineTo(x, 90 + Math.max(0, Math.sin((x - 150) / 700 * Math.PI * 4)) * 90);
        c.stroke();
        P(c, [[850, 90], [890, 112], [906, 98], [880, 84]]);
        for (var p = 200; p <= 800; p += 120) R(c, p, 0, 10, 72);
        palm(c, 60, 160, 15); palm(c, 950, 150, -18);
      } },
    singapore: { cap: "マリーナベイ・サンズとスーパーツリー", h: 190, h2: 320, water: 50, sun: [180, 320],
      far: function (c, a, b) { skyline(c, a, b, 60, 180, 71, 18, 40); },
      near: function (c, a, b) {
        [535, 605, 675].forEach(function (x) { P(c, [[x - 20, 0], [x + 20, 0], [x + 15, 230], [x - 15, 230]]); });
        c.beginPath(); c.moveTo(500, 232); c.lineTo(740, 232); c.quadraticCurveTo(760, 236, 770, 246); c.lineTo(500, 248); c.closePath(); c.fill();
        [230, 300, 360].forEach(function (x, i) { var h = [200, 260, 180][i]; P(c, [[x - 8, 0], [x + 8, 0], [x + 3, h - 30], [x + 34, h], [x - 34, h], [x - 3, h - 30]]); });
        P(c, [[880, 50], [880, 110], [895, 125], [915, 118], [915, 50]]); R(c, 870, 0, 55, 52);
      } },
    bali: { cap: "割れ門（チャンディ・ブンタル）とライステラス", h: 140, h2: 40, sun: [760, 260],
      far: function (c, a, b) { P(c, [[a, 0], [a, 60], [150, 90], [330, 260], [380, 270], [560, 90], [b, 60], [b, 0]]); },
      near: function (c, a, b) {
        hills(c, a, b, 110, 20, 17);
        cut(c, function () {
          c.lineWidth = 3;
          for (var k = 0; k < 5; k++) { c.beginPath(); for (var x = a; x <= b; x += 10) c.lineTo(x, 18 + k * 20 + 8 * Math.sin(x / 90 + k)); c.stroke(); }
        });
        for (var i = 0; i < 9; i++) { var w = 80 - i * 7; R(c, 480 - w, i * 32, w, 32); R(c, 520, i * 32, w, 32); }
        palm(c, 150, 220, 20); palm(c, 830, 200, -18);
      } },
    cebu: { cap: "ビーチとバンカーボート", h: 190, h2: 170, water: 70, sun: [700, 300],
      far: function (c) { E(c, 760, 70, 200, 50); E(c, 900, 70, 120, 70); },
      near: function (c, a) {
        P(c, [[a, 0], [a, 80], [120, 75], [330, 40], [420, 0]]);
        palm(c, 120, 240, 40); palm(c, 220, 190, -30); palm(c, 300, 140, 20);
        P(c, [[540, 60], [660, 60], [680, 74], [520, 74]]);
        c.lineWidth = 3; c.beginPath(); c.moveTo(500, 80); c.lineTo(700, 80); c.moveTo(560, 74); c.lineTo(540, 82); c.moveTo(640, 74); c.lineTo(660, 82); c.stroke();
      } },
    guam: { cap: "恋人岬とタモン湾", h: 20, h2: 200, water: 60, sun: [500, 130],
      far: function () {},
      near: function (c, a, b) {
        P(c, [[700, 0], [700, 60], [760, 200], [840, 260], [960, 290], [b, 290], [b, 0]]);
        P(c, [[a, 0], [a, 70], [260, 60], [340, 0]]);
        palm(c, 100, 220, 30); palm(c, 190, 170, -25);
      } },
    honolulu: { cap: "ダイヤモンドヘッドとワイキキ", h: 195, h2: 45, water: 45, sun: [220, 320],
      far: function (c, a, b) { P(c, [[480, 0], [480, 60], [560, 120], [640, 170], [690, 210], [730, 200], [780, 215], [840, 195], [900, 150], [b, 90], [b, 0]]); },
      near: function (c) {
        skyline(c, 150, 520, 50, 130, 81, 22, 40);
        palm(c, 60, 260, 30); palm(c, 130, 200, -20); palm(c, 600, 160, 15);
        P(c, [[760, 48], [820, 50], [815, 54], [765, 52]]); R(c, 786, 54, 6, 22); C(c, 789, 80, 5);
      } },
    sydney: { cap: "オペラハウスとハーバーブリッジ", h: 200, h2: 30, water: 50, sun: [880, 320],
      far: function (c, a, b) { skyline(c, a, b, 40, 140, 91); },
      near: function (c) {
        R(c, 170, 50, 300, 20);
        [[190, 300, 160], [250, 360, 190], [310, 430, 150], [380, 470, 110]].forEach(function (s) {
          c.beginPath(); c.moveTo(s[0], 70); c.quadraticCurveTo(s[0] + 10, 70 + s[2], s[1], 70 + s[2] * 0.95);
          c.quadraticCurveTo(s[1] - 30, 120, s[1] - 10, 70); c.closePath(); c.fill();
        });
        c.lineWidth = 10; c.beginPath(); c.moveTo(590, 80); c.quadraticCurveTo(740, 300, 890, 80); c.stroke();
        R(c, 540, 95, 400, 8); R(c, 560, 0, 30, 140); R(c, 890, 0, 30, 140);
      } },
    newyork: { cap: "自由の女神とマンハッタン", h: 210, h2: 30, water: 45, sun: [700, 320],
      far: function (c, a, b) { skyline(c, 330, b, 60, 200, 101, 16, 36); },
      near: function (c) {
        P(c, [[110, 0], [210, 0], [195, 60], [125, 60]]); R(c, 140, 60, 40, 60);
        P(c, [[148, 120], [172, 120], [168, 200], [152, 200]]); C(c, 160, 208, 9);
        P(c, [[166, 190], [172, 192], [184, 250], [178, 252]]); P(c, [[176, 250], [188, 250], [186, 264], [178, 264]]);
        [-0.5, -0.25, 0, 0.25, 0.5].forEach(function (t) { P(c, [[157, 214], [163, 214], [160 + Math.sin(t) * 20, 214 + Math.cos(t) * 18]]); });
        R(c, 560, 0, 90, 200); R(c, 575, 200, 60, 50); R(c, 590, 250, 30, 40); R(c, 598, 290, 14, 20); R(c, 603, 310, 4, 60);
        R(c, 720, 0, 50, 230); P(c, [[720, 230], [745, 300], [770, 230]]); R(c, 744, 300, 2, 30);
      } },
    la: { cap: "グリフィス天文台とパームツリー", h: 30, h2: 200, sun: [800, 300],
      far: function (c, a, b) { skyline(c, 260, 480, 60, 190, 111, 20, 40); hills(c, a, b, 60, 15, 19); },
      near: function (c, a, b) {
        P(c, [[a, 0], [a, 80], [300, 110], [520, 190], [700, 170], [900, 120], [b, 100], [b, 0]]);
        // 天文台：中央の大ドームと左右の小ドーム
        R(c, 470, 176, 160, 34); R(c, 530, 210, 60, 18); C(c, 560, 228, 30);
        R(c, 478, 210, 26, 10); C(c, 491, 220, 13); R(c, 596, 210, 26, 10); C(c, 609, 220, 13);
        palm(c, 90, 320, 10, 55); palm(c, 150, 280, -10, 50); palm(c, 880, 330, -8, 55); palm(c, 940, 290, 12, 50);
      } },
    vancouver: { cap: "カナダプレイスとノースショアの山々", h: 200, h2: 180, water: 50, sun: [200, 320],
      far: function (c, a, b) { peaks(c, [[a, 150], [80, 220], [180, 170], [300, 260], [420, 190], [560, 280], [700, 200], [820, 250], [940, 180], [b, 200]]); },
      near: function (c) {
        skyline(c, 420, 900, 70, 190, 121, 16, 34);
        R(c, 180, 50, 220, 26);
        [200, 240, 280, 320, 360].forEach(function (x, i) { P(c, [[x - 18, 76], [x + 18, 76], [x, 130 + (i % 2) * 20]]); });
      } },
    london: { cap: "ビッグ・ベンとロンドン・アイ", h: 215, h2: 230, sun: [520, 330],
      far: function (c, a, b) { skyline(c, a, b, 30, 100, 131); P(c, [[520, 0], [548, 300], [552, 300], [580, 0]]); },
      near: function (c) {
        R(c, 180, 0, 40, 250); R(c, 172, 250, 56, 50); P(c, [[172, 300], [228, 300], [200, 370]]); R(c, 199, 370, 2, 20);
        cut(c, function () { C(c, 200, 275, 15); });
        R(c, 220, 0, 260, 110);
        for (var x = 236; x < 480; x += 30) P(c, [[x - 5, 110], [x + 5, 110], [x, 140]]);
        c.lineWidth = 6; c.beginPath(); c.arc(760, 200, 140, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 1.5; c.beginPath();
        for (var t = 0; t < Math.PI * 2; t += Math.PI / 12) { c.moveTo(760, 200); c.lineTo(760 + Math.cos(t) * 140, 200 + Math.sin(t) * 140); }
        c.stroke();
        for (var u = 0; u < Math.PI * 2; u += Math.PI / 12) C(c, 760 + Math.cos(u) * 146, 200 + Math.sin(u) * 146, 6);
        c.lineWidth = 6; c.beginPath(); c.moveTo(700, 0); c.lineTo(760, 200); c.lineTo(820, 0); c.stroke();
      } },
    paris: { cap: "エッフェル塔と凱旋門", h: 215, h2: 340, sun: [180, 320],
      far: function (c, a, b) { skyline(c, a, b, 40, 75, 141, 30, 60); },
      near: function (c) {
        P(c, [[680, 0], [726, 110], [736, 175], [748, 280], [756, 360], [764, 360], [772, 280], [784, 175], [794, 110], [840, 0]]);
        R(c, 708, 104, 104, 10); R(c, 728, 170, 64, 7); R(c, 744, 276, 32, 6); R(c, 758, 360, 4, 30);
        cut(c, function () { E(c, 760, 0, 46, 82); P(c, [[748, 120], [772, 120], [764, 165], [756, 165]]); });
        R(c, 190, 0, 120, 130); R(c, 184, 120, 132, 14);
        cut(c, function () { arch(c, 232, 0, 36, 90); });
      } },
    rome: { cap: "コロッセオとサン・ピエトロ大聖堂", h: 30, h2: 45, sun: [820, 300],
      far: function (c, a, b) { skyline(c, a, b, 30, 70, 151, 30, 60); R(c, 110, 0, 120, 110); C(c, 170, 150, 55); R(c, 166, 200, 8, 30); },
      near: function (c) {
        P(c, [[320, 0], [320, 150], [380, 168], [520, 178], [640, 200], [700, 210], [700, 0]]);
        cut(c, function () {
          for (var row = 0; row < 3; row++) for (var x = 334; x < 690; x += 34) { if (row === 2 && x < 420) continue; arch(c, x, 12 + row * 52, 20, 40); }
        });
        [880, 910, 950].forEach(function (x, i) { R(c, x - 2, 0, 4, 30); E(c, x, 90 + i * 5, 12, 65 + i * 5); });
      } },
    barcelona: { cap: "サグラダ・ファミリア", h: 200, h2: 30, sun: [200, 300],
      far: function (c, a, b) { hills(c, a, b, 110, 30, 23); },
      near: function (c, a, b) {
        skyline(c, a, b, 30, 70, 161, 30, 60);
        R(c, 420, 0, 200, 150);
        [[450, 260], [485, 310], [520, 380], [555, 310], [590, 260]].forEach(function (s) {
          P(c, [[s[0] - 15, 0], [s[0] - 15, s[1] * 0.7], [s[0] - 6, s[1] * 0.95], [s[0], s[1]], [s[0] + 6, s[1] * 0.95], [s[0] + 15, s[1] * 0.7], [s[0] + 15, 0]]);
          C(c, s[0], s[1] + 4, 5);
        });
        cut(c, function () { for (var x = 450; x <= 590; x += 35) for (var y = 160; y < 240; y += 26) E(c, x, y, 3, 8); });
        palm(c, 120, 170, 15, 55); palm(c, 860, 180, -12, 55);
      } },
    istanbul: { cap: "ブルーモスクとガラタ塔", h: 25, h2: 210, water: 50, sun: [820, 310],
      far: function (c, a, b) { hills(c, a, b, 90, 25, 29); R(c, 840, 0, 40, 190); P(c, [[836, 190], [884, 190], [860, 250]]); },
      near: function (c) {
        R(c, 360, 0, 280, 140); C(c, 500, 140, 90); C(c, 410, 130, 48); C(c, 590, 130, 48); R(c, 498, 228, 4, 26);
        [310, 345, 655, 690].forEach(function (x) { R(c, x - 6, 0, 12, 300); P(c, [[x - 6, 300], [x + 6, 300], [x, 350]]); R(c, x - 9, 220, 18, 6); R(c, x - 9, 260, 18, 6); });
        P(c, [[120, 46], [250, 46], [235, 30], [130, 30]]); R(c, 150, 46, 80, 18); R(c, 180, 64, 10, 20);
      } },
    dubai: { cap: "ブルジュ・ハリファとブルジュ・アル・アラブ", h: 35, h2: 200, water: 40, sun: [260, 300],
      far: function (c, a, b) { skyline(c, 420, b, 60, 180, 171, 18, 40); hills(c, a, b, 40, 12, 31, 0.6); },
      near: function (c) {
        [[70, 120], [54, 200], [40, 270], [28, 330], [16, 370], [4, 420]].reduce(function (y, s) { R(c, 700 - s[0] / 2, y, s[0], s[1] - y); return s[1]; }, 0);
        c.beginPath(); c.moveTo(190, 40); c.lineTo(190, 270); c.quadraticCurveTo(300, 220, 290, 40); c.closePath(); c.fill();
        R(c, 186, 40, 4, 250); R(c, 170, 30, 140, 12);
      } }
  };

  function hsl(h, s, l, al) { return "hsla(" + h + "," + s + "%," + l + "%," + (al == null ? 1 : al) + ")"; }
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  var bgA = document.getElementById("bgA"), bgB = document.getElementById("bgB");
  var bgFront = bgA, bgId = "", bgKey = "";

  function draw(id, force) {
    if (!bgA || !bgB) return;
    var dark = isDark(), W = window.innerWidth, H = window.innerHeight;
    var key = id + "|" + dark + "|" + W + "x" + H;
    if (key === bgKey && !force) return;
    var sc = SCENES[id];
    if (!sc) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var target = bgId && id !== bgId ? (bgFront === bgA ? bgB : bgA) : bgFront;
    target.width = Math.round(W * dpr); target.height = Math.round(H * dpr);
    var c = target.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var g = c.createLinearGradient(0, 0, 0, H);
    if (dark) { g.addColorStop(0, hsl(sc.h, 45, 8)); g.addColorStop(1, hsl(sc.h2, 40, 20)); }
    else { g.addColorStop(0, hsl(sc.h, 55, 80)); g.addColorStop(1, hsl(sc.h2, 70, 93)); }
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    var s = Math.min(Math.max(W / 1000, H * 0.32 / 400), H * 0.55 / 400);
    var ox = (W - 1000 * s) / 2, left = -ox / s - 10, right = (W - ox) / s + 10;

    if (dark) {
      var r = rng(99);
      c.fillStyle = "#ffffff";
      for (var i = 0; i < 110; i++) { c.globalAlpha = 0.15 + r() * 0.6; c.fillRect(r() * W, r() * H * 0.65, 1.4, 1.4); }
      c.globalAlpha = 1;
    }
    var sx = ox + sc.sun[0] * s, sy = H - sc.sun[1] * s, sr = 34 * s;
    var glow = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
    glow.addColorStop(0, dark ? "rgba(255,246,220,0.18)" : "rgba(255,250,235,0.7)");
    glow.addColorStop(1, "rgba(255,250,235,0)");
    c.fillStyle = glow; c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    c.fillStyle = dark ? "rgba(250,244,225,0.85)" : hsl(sc.h2, 90, 97, 0.95);
    c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();

    function layer(fn, color, alpha) {
      var o = document.createElement("canvas");
      o.width = target.width; o.height = target.height;
      var lc = o.getContext("2d");
      lc.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ox, dpr * H);
      lc.fillStyle = color; lc.strokeStyle = color; lc.lineCap = "round"; lc.lineJoin = "round";
      fn(lc, left, right);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.drawImage(o, 0, 0); c.restore();
    }
    layer(sc.far, dark ? hsl(sc.h, 30, 16) : hsl(sc.h, 30, 55), dark ? 0.9 : 0.35);
    if (sc.water) {
      var wy = H - sc.water * s;
      c.fillStyle = dark ? hsl(sc.h, 45, 22, 0.6) : hsl(sc.h, 55, 62, 0.35);
      c.fillRect(0, wy, W, H - wy);
      c.fillStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.45)";
      var wr = rng(5);
      for (var k = 0; k < 26; k++) c.fillRect(wr() * W, wy + 4 + wr() * (H - wy - 6), 20 + wr() * 60, 1.5);
    }
    layer(sc.near, dark ? hsl(sc.h, 40, 5) : hsl(sc.h, 35, 28), dark ? 0.92 : 0.32);

    if (target !== bgFront) { target.style.opacity = "1"; bgFront.style.opacity = "0"; bgFront = target; }
    bgId = id; bgKey = key;
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (bgId) draw(bgId); }, 150);
  });
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", function () { if (bgId) draw(bgId); });
  }

  window.TRIP_SCENES = { SCENES: SCENES, draw: draw };
})();
