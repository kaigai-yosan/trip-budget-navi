// BGM：レイジ系の重低音ビートをブラウザの中で生成して流す（音源ファイルは使わない）
// 150BPM・Gマイナー。808ベース、キック、クラップ、ロール入りのハイハット、歪ませたシンセ（和音のスタブとアルペジオ）。
// 右下のボタンで再生・停止、つまみで音量、WAVボタンでこのビートをファイルに保存できる。
(function () {
  "use strict";
  var BPM = 150, STEP = 60 / BPM / 4, BARS = 8, LOOP = BARS * 16;
  var ROOTS = [31, 27, 34, 29];                                          // 808の音程：G1, Eb1, Bb1, F1
  var CHORDS = [[55, 58, 62], [51, 55, 58], [58, 62, 65], [53, 57, 60]]; // Gm, Eb, Bb, F（各2小節）
  // 1小節＝16ステップ。[0]が奇数小節、[1]が偶数小節のパターン
  var P = {
    kick: [[0, 7, 10], [0, 6, 10, 15]],
    clap: [[8], [8]],
    ghost: [[15], [13, 14]],
    open: [[6, 14], [6]],
    bass: [[[0, 0, 6], [7, 0, 3], [10, 7, 5]], [[0, 0, 6], [6, 0, 2], [10, 12, 3], [13, 7, 3]]], // [ステップ, 半音の差, 長さ(ステップ)]
    stab: [[[0, 5], [6, 2], [10, 2]], []]                                                      // [ステップ, 長さ(ステップ)]
  };
  var HV = [0.55, 0.2, 0.4, 0.2, 0.5, 0.2, 0.4, 0.25, 0.55, 0.2, 0.4, 0.2, 0.5, 0.25, 0.45, 0.3];
  var ARP = [0, 2, 1, 2, 0, 1, 2, 1];

  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function curve(k) { var n = 1024, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
  function has(arr, v) { return arr.indexOf(v) >= 0; }

  // ===== 音の部品 =====
  function build(ctx, vol) {
    var g = { ctx: ctx };
    g.master = ctx.createGain(); g.master.gain.value = vol;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.12;
    var out = ctx.createGain(); out.gain.value = 0.92;
    g.master.connect(comp); comp.connect(out); out.connect(ctx.destination);

    g.drums = ctx.createGain(); g.drums.gain.value = 0.9; g.drums.connect(g.master);

    // 808：歪ませて、小さなスピーカーでも低音の倍音が聞こえるようにする
    g.bass = ctx.createGain(); g.bass.gain.value = 1;
    var sat = ctx.createWaveShaper(); sat.curve = curve(3.2); sat.oversample = "2x";
    var blp = ctx.createBiquadFilter(); blp.type = "lowpass"; blp.frequency.value = 2400;
    g.bass.connect(sat); sat.connect(blp); blp.connect(g.master);

    // シンセ：キックのたびに音量を下げ（サイドチェイン風）、ディレイで広げる
    g.synth = ctx.createGain(); g.synth.gain.value = 1;
    g.duck = ctx.createGain(); g.duck.gain.value = 1;
    var dry = ctx.createGain(); dry.gain.value = 0.55;
    var dl = ctx.createDelay(1); dl.delayTime.value = STEP * 3;
    var fb = ctx.createGain(); fb.gain.value = 0.38;
    var dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 3000;
    var wet = ctx.createGain(); wet.gain.value = 0.34;
    g.synth.connect(g.duck); g.duck.connect(dry); dry.connect(g.master);
    g.duck.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(g.master);

    var len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    g.noise = buf;
    return g;
  }
  function noise(g, t, dur) {
    var s = g.ctx.createBufferSource(); s.buffer = g.noise; s.loop = true;
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
    return s;
  }
  // 音量の変化：t から rise 秒で peak まで上げ、t から fall 秒後に消える（rise・fall は秒の長さ）
  function env(a, t, peak, rise, fall) {
    a.gain.setValueAtTime(0.0001, t);
    a.gain.linearRampToValueAtTime(peak, t + rise);
    a.gain.exponentialRampToValueAtTime(0.0001, t + fall);
  }
  function kick(g, t, v) {
    var c = g.ctx, o = c.createOscillator(), a = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.1);
    env(a, t, v, 0.002, 0.32);
    o.connect(a); a.connect(g.drums); o.start(t); o.stop(t + 0.36);
    var n = noise(g, t, 0.03), hp = c.createBiquadFilter(), ng = c.createGain();
    hp.type = "highpass"; hp.frequency.value = 2500; env(ng, t, v * 0.35, 0.001, 0.015);
    n.connect(hp); hp.connect(ng); ng.connect(g.drums);
    g.duck.gain.setValueAtTime(0.42, t); g.duck.gain.linearRampToValueAtTime(1, t + 0.15);
  }
  function clap(g, t, v, single) {
    var c = g.ctx, offs = single ? [0] : [0, 0.011, 0.023];
    offs.forEach(function (off, i) {
      var last = i === offs.length - 1, n = noise(g, t + off, 0.2), bp = c.createBiquadFilter(), a = c.createGain();
      bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 1.1;
      env(a, t + off, v * 0.8, 0.001, last ? 0.16 : 0.012);
      n.connect(bp); bp.connect(a); a.connect(g.drums);
    });
    var o = c.createOscillator(), oa = c.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.07);
    env(oa, t, v * 0.3, 0.001, 0.1);
    o.connect(oa); oa.connect(g.drums); o.start(t); o.stop(t + 0.12);
  }
  function hat(g, t, v, open) {
    var c = g.ctx, n = noise(g, t, open ? 0.25 : 0.06), hp = c.createBiquadFilter(), a = c.createGain();
    hp.type = "highpass"; hp.frequency.value = 8000;
    env(a, t, v * 0.4, 0.001, open ? 0.2 : 0.03);
    n.connect(hp); hp.connect(a); a.connect(g.drums);
  }
  function crash(g, t) {
    var c = g.ctx, n = noise(g, t, 1.5), hp = c.createBiquadFilter(), a = c.createGain();
    hp.type = "highpass"; hp.frequency.value = 6000;
    env(a, t, 0.2, 0.005, 1.4);
    n.connect(hp); hp.connect(a); a.connect(g.drums);
  }
  function bass808(g, t, midi, dur, from) {
    var c = g.ctx, f = mtof(midi), o = c.createOscillator(), o2 = c.createOscillator(), a = c.createGain(), a2 = c.createGain();
    o.type = "sine"; o2.type = "triangle";
    if (from) {
      var f0 = mtof(from);
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      o2.frequency.setValueAtTime(f0, t); o2.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    } else {
      o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
      o2.frequency.setValueAtTime(f, t);
    }
    env(a, t, 1, 0.006, dur);
    a2.gain.value = 0.22;
    o.connect(a); o2.connect(a2); a2.connect(a); a.connect(g.bass);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function synth(g, t, midi, dur, v) {
    var c = g.ctx, f = mtof(midi), lp = c.createBiquadFilter(), a = c.createGain(), sh = c.createWaveShaper();
    lp.type = "lowpass"; lp.Q.value = 5;
    lp.frequency.setValueAtTime(7000, t); lp.frequency.exponentialRampToValueAtTime(1400, t + Math.min(dur, 0.4));
    sh.curve = curve(2.2);
    env(a, t, v, 0.006, dur);
    [-16, 0, 16].forEach(function (d) {
      var o = c.createOscillator(), og = c.createGain();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = d + (Math.random() - 0.5) * 6;
      og.gain.value = 0.33; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
    lp.connect(sh); sh.connect(a); a.connect(g.synth);
  }

  // ===== 1ステップぶんの演奏 =====
  function playStep(g, abs, t) {
    var ls = abs % LOOP, bar = (ls / 16) | 0, s = ls % 16, ci = (bar / 2) | 0, vr = bar % 2, root = ROOTS[ci];
    if (ls === 0) crash(g, t);
    if (has(P.kick[vr], s)) kick(g, t, 0.95);
    if (has(P.clap[vr], s)) clap(g, t, 0.8, false);
    if (has(P.ghost[vr], s)) clap(g, t, 0.22, true);
    if (has(P.open[vr], s)) hat(g, t, 0.6, true);
    else if (!(vr === 1 && s === 15)) hat(g, t, HV[s], false);
    if (vr === 1 && s === 14) hat(g, t + STEP / 2, 0.35, false);
    if (vr === 1 && s === 15) [0, 1 / 3, 2 / 3].forEach(function (k) { hat(g, t + k * STEP, 0.4 + k * 0.3, false); }); // 小節の終わりの3連ロール
    var list = P.bass[vr];
    list.forEach(function (n, i) {
      if (n[0] !== s) return;
      var from = i > 0 && n[1] !== list[i - 1][1] ? root + list[i - 1][1] : 0;
      bass808(g, t, root + n[1], n[2] * STEP, from);
    });
    P.stab[vr].forEach(function (n) { if (n[0] === s) CHORDS[ci].forEach(function (m) { synth(g, t, m, n[1] * STEP * 1.1, 0.15); }); });
    if (vr === 1 && s % 2 === 0) synth(g, t, CHORDS[ci][ARP[s / 2] % 3] + 12, STEP * 1.8, 0.2); // 速いアルペジオ
  }

  // ===== 再生 =====
  var ctx = null, G = null, timer = null, nextT = 0, step = 0, playing = false, want = true, vol = 0.45, armed = false;
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function tick() {
    if (!playing) return;
    while (nextT < ctx.currentTime + 0.25) { playStep(G, step, nextT); nextT += STEP; step++; }
    timer = setTimeout(tick, 40);
  }
  function begin() {
    if (playing) return;
    playing = true;
    G.master.gain.cancelScheduledValues(ctx.currentTime);
    G.master.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
    step = Math.floor((parseInt(load("bgm.step"), 10) || 0) / 16) * 16; // 前のページの続きの小節から始める
    nextT = ctx.currentTime + 0.08;
    tick(); ui();
  }
  function start() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); G = build(ctx, vol);
    }
    ctx.resume().then(begin, function () { showHint(true); });
  }
  function stop() {
    playing = false; clearTimeout(timer);
    if (G && ctx) {
      G.master.gain.cancelScheduledValues(ctx.currentTime);
      G.master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(function () { if (!playing && ctx) ctx.suspend(); }, 400);
    }
    ui();
  }

  // ===== 画面 =====
  var css = ".bgm{position:fixed;right:calc(12px + env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:40;display:flex;align-items:center;gap:8px;" +
    "padding:6px 8px 6px 6px;border:1px solid var(--line,#d5dce2);border-radius:99px;background:var(--paper,#fff);color:var(--ink,#132230);box-shadow:0 4px 18px rgba(0,0,0,.18);font:700 12px var(--f-body,sans-serif)}" +
    ".bgm button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;border-radius:99px;padding:6px 10px}" +
    ".bgm-btn{display:flex;align-items:center;gap:8px;background:var(--ink,#132230)!important;color:var(--paper,#fff)!important}" +
    ".bgm-btn:hover{background:var(--accent,#2440c9)!important;color:var(--on-accent,#fff)!important}" +
    ".bgm-eq{display:inline-flex;align-items:flex-end;gap:2px;height:14px}.bgm-eq i{display:block;width:3px;height:3px;background:currentColor;border-radius:1px}" +
    ".bgm.on .bgm-eq i{animation:bgmEq .5s ease-in-out infinite alternate}.bgm.on .bgm-eq i:nth-child(2){animation-delay:-.2s}.bgm.on .bgm-eq i:nth-child(3){animation-delay:-.35s}.bgm.on .bgm-eq i:nth-child(4){animation-delay:-.1s}" +
    "@keyframes bgmEq{from{height:3px}to{height:14px}}" +
    ".bgm-vol{width:84px;accent-color:var(--accent,#2440c9)}" +
    ".bgm-save{border:1px solid var(--line,#d5dce2)!important;font-size:11px!important;padding:4px 9px!important}.bgm-save:hover{border-color:var(--accent,#2440c9)!important;color:var(--accent,#2440c9)}" +
    ".bgm button:focus-visible,.bgm input:focus-visible{outline:2px solid var(--accent,#2440c9);outline-offset:2px}" +
    ".bgm-hint{position:absolute;right:0;bottom:calc(100% + 8px);white-space:nowrap;background:var(--ink,#132230);color:var(--paper,#fff);padding:5px 12px;border-radius:8px;font-weight:500}" +
    "@media (max-width:480px){.bgm-vol{width:56px}}@media (prefers-reduced-motion:reduce){.bgm.on .bgm-eq i{animation:none;height:9px}}@media print{.bgm{display:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var box = document.createElement("div");
  box.className = "bgm";
  box.innerHTML = '<button type="button" class="bgm-btn" aria-pressed="false" aria-label="BGMの再生と停止"><span>BGM</span><span class="bgm-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>' +
    '<input class="bgm-vol" type="range" min="0" max="100" value="45" aria-label="BGMの音量">' +
    '<button type="button" class="bgm-save" title="このビートをWAVファイルで保存します">WAV</button>' +
    '<span class="bgm-hint" role="status" hidden>タップするとBGMが流れます</span>';
  document.body.appendChild(box);
  var btn = box.querySelector(".bgm-btn"), range = box.querySelector(".bgm-vol"), save = box.querySelector(".bgm-save"), hint = box.querySelector(".bgm-hint");
  function showHint(on) { hint.hidden = !on; }
  function ui() {
    box.classList.toggle("on", playing);
    btn.setAttribute("aria-pressed", playing ? "true" : "false");
    showHint(!playing && want && !!armed);
  }
  var v0 = parseFloat(load("bgm.vol"));
  if (v0 >= 0 && v0 <= 1) vol = v0;
  range.value = String(Math.round(vol * 100));
  range.addEventListener("input", function () {
    vol = range.value / 100; store("bgm.vol", vol);
    if (G && ctx && playing) G.master.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  });
  btn.addEventListener("click", function () {
    if (playing) { want = false; store("bgm.on", "0"); stop(); }
    else { want = true; store("bgm.on", "1"); disarm(); start(); }
  });
  window.addEventListener("pagehide", function () { store("bgm.step", String(step)); });

  // ブラウザは音の自動再生を禁止しているので、最初の操作（タップ・キー入力）でBGMを始める
  function onGesture(e) {
    if (box.contains(e.target)) return;
    disarm();
    if (want && !playing) start();
  }
  var evs = ["pointerdown", "keydown", "touchend"];
  function arm() { if (armed) return; armed = true; evs.forEach(function (n) { document.addEventListener(n, onGesture, true); }); ui(); }
  function disarm() { armed = false; evs.forEach(function (n) { document.removeEventListener(n, onGesture, true); }); }

  // ===== WAV保存（同じビートを書き出す）=====
  function renderLoop() {
    var rate = 44100, secs = LOOP * STEP + 1.5, oc = new OfflineAudioContext(2, Math.ceil(rate * secs), rate), g = build(oc, 0.8);
    for (var i = 0; i < LOOP; i++) playStep(g, i, 0.05 + i * STEP);
    return oc.startRendering();
  }
  function toWav(buf) {
    var n = buf.length, ch = buf.numberOfChannels, peak = 0, c, i;
    for (c = 0; c < ch; c++) { var d = buf.getChannelData(c); for (i = 0; i < n; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; } }
    var k = peak > 0 ? 0.89 / peak : 1, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    function str(o, s) { for (var j = 0; j < s.length; j++) out.setUint8(o + j, s.charCodeAt(j)); }
    str(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE"); str(12, "fmt "); out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true);
    out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    str(36, "data"); out.setUint32(40, n * ch * 2, true);
    var o = 44, chans = [];
    for (c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    for (i = 0; i < n; i++) for (c = 0; c < ch; c++) { var s2 = Math.max(-1, Math.min(1, chans[c][i] * k)); out.setInt16(o, s2 < 0 ? s2 * 0x8000 : s2 * 0x7fff, true); o += 2; }
    return new Blob([out], { type: "audio/wav" });
  }
  save.addEventListener("click", function () {
    save.textContent = "…"; save.disabled = true;
    renderLoop().then(function (buf) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(toWav(buf)); a.download = "rage-beat-150bpm.wav";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }).catch(function () {}).then(function () { save.textContent = "WAV"; save.disabled = false; });
  });

  // テスト・確認用
  window.TRIP_BGM = {
    isPlaying: function () { return playing; },
    wants: function () { return want; },
    hintShown: function () { return !hint.hidden; },
    analyze: function () {
      return renderLoop().then(function (buf) {
        var d = buf.getChannelData(0), n = d.length, peak = 0, sum = 0, low = 0, y = 0, al = 2 * Math.PI * 120 / buf.sampleRate, i;
        for (i = 0; i < n; i++) { var x = d[i]; if (Math.abs(x) > peak) peak = Math.abs(x); sum += x * x; y += al * (x - y); low += y * y; }
        return { seconds: n / buf.sampleRate, peak: peak, rms: Math.sqrt(sum / n), lowShare: low / sum, wav: toWav(buf) };
      });
    }
  };

  // ===== 起動 =====
  want = load("bgm.on") !== "0";
  ui();
  if (want) {
    arm();
    // 自動再生が許可されている環境なら、操作を待たずに始める
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC(); G = build(ctx, vol);
        setTimeout(function () { if (ctx.state === "running" && want && !playing) { disarm(); begin(); } }, 200);
      }
    } catch (e) {}
  }
})();
