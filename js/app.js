/* 黒白夜蝶 · CRT水银失真剧场 — interactions */
(() => {
  "use strict";

  const theater = document.getElementById("theater");
  const chapters = [...document.querySelectorAll(".ch")];
  const railBtns = [...document.querySelectorAll(".rail-btn")];
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnSound = document.getElementById("btnSound");
  const btnEnter = document.getElementById("btnEnter");
  const btnRewind = document.getElementById("btnRewind");
  const ttClock = document.getElementById("ttClock");
  const ttTitle = document.getElementById("ttTitle");
  const feedGreen = document.getElementById("feedGreen");
  const feedMagenta = document.getElementById("feedMagenta");
  const rgbAberration = document.getElementById("rgbAberration");
  const ejectLayer = document.getElementById("ejectLayer");
  const ejectImg = document.getElementById("ejectImg");
  const ejectCap = document.getElementById("ejectCap");
  const ejectClose = document.getElementById("ejectClose");
  const kLines = [...document.querySelectorAll(".k-line")];
  const kBar = document.getElementById("kBar");
  const poll = document.getElementById("poll");
  const pollResult = document.getElementById("pollResult");

  let current = 0;
  let soundOn = false;
  let audioCtx = null;
  let desyncTimer = null;
  let snapLock = false;

  /* ---- Touch detection: restore cursor ---- */
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add("touch-mode");
  }

  /* ---- Clock ---- */
  function tickClock() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    ttClock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---- Sound (muted default) ---- */
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }
  function beep(freq = 440, dur = 0.06, type = "square", gain = 0.03) {
    if (!soundOn || !audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  }
  function vhsBlip() {
    beep(120, 0.08, "sawtooth", 0.025);
    setTimeout(() => beep(80, 0.05, "square", 0.02), 40);
  }

  btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    btnSound.setAttribute("aria-pressed", String(soundOn));
    btnSound.textContent = soundOn ? "🔊 ON" : "🔇 MUTE";
    if (soundOn) {
      ensureAudio();
      beep(660, 0.05);
    }
  });

  /* ---- Navigate chapters ---- */
  function goTo(i, smooth = true) {
    i = Math.max(0, Math.min(chapters.length - 1, i));
    current = i;
    const el = chapters[i];
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    updateUI();
    vhsBlip();
  }

  function updateUI() {
    railBtns.forEach((b, idx) => b.classList.toggle("active", idx === current));
    btnPrev.disabled = current === 0;
    btnNext.disabled = current === chapters.length - 1;
    const ch = chapters[current];
    const name = ch.dataset.ch || "";
    ttTitle.textContent = `卡黄 · ${name}`;
    if (feedGreen) feedGreen.textContent = ch.dataset.feedG || "—";
    if (feedMagenta) feedMagenta.textContent = ch.dataset.feedM || "—";
  }

  /* IntersectionObserver for snap index */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && en.intersectionRatio > 0.45) {
          const idx = chapters.indexOf(en.target);
          if (idx >= 0 && idx !== current) {
            current = idx;
            updateUI();
          }
        }
      });
    },
    { root: theater, threshold: [0.45, 0.6] }
  );
  chapters.forEach((c) => io.observe(c));

  railBtns.forEach((b) => {
    b.addEventListener("click", () => goTo(Number(b.dataset.goto)));
  });
  btnPrev.addEventListener("click", () => goTo(current - 1));
  btnNext.addEventListener("click", () => goTo(current + 1));
  btnEnter?.addEventListener("click", () => goTo(1));
  btnRewind?.addEventListener("click", () => goTo(0));

  /* Wheel / swipe between chapters (magnetic) */
  let wheelAcc = 0;
  let wheelReset;
  theater.addEventListener(
    "wheel",
    (e) => {
      if (snapLock) {
        e.preventDefault();
        return;
      }
      // only take over when near chapter boundaries / intentional flick
      wheelAcc += e.deltaY;
      clearTimeout(wheelReset);
      wheelReset = setTimeout(() => (wheelAcc = 0), 180);
      if (Math.abs(wheelAcc) > 80) {
        e.preventDefault();
        snapLock = true;
        const dir = wheelAcc > 0 ? 1 : -1;
        wheelAcc = 0;
        goTo(current + dir);
        setTimeout(() => (snapLock = false), 700);
      }
    },
    { passive: false }
  );

  let touchY = null;
  theater.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  theater.addEventListener(
    "touchend",
    (e) => {
      if (touchY == null) return;
      const dy = touchY - e.changedTouches[0].clientY;
      touchY = null;
      if (Math.abs(dy) > 60 && !snapLock) {
        snapLock = true;
        goTo(current + (dy > 0 ? 1 : -1));
        setTimeout(() => (snapLock = false), 700);
      }
    },
    { passive: true }
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
      e.preventDefault();
      goTo(current - 1);
    } else if (e.key === "Escape") {
      closeEject();
    }
  });

  /* ---- CRT desync on quote click ---- */
  document.querySelectorAll("[data-desync]").forEach((q) => {
    q.addEventListener("click", () => {
      document.body.classList.add("desync");
      rgbAberration.classList.add("on");
      beep(90, 0.12, "sawtooth", 0.04);
      clearTimeout(desyncTimer);
      desyncTimer = setTimeout(() => {
        document.body.classList.remove("desync");
        rgbAberration.classList.remove("on");
      }, 900);
    });
  });

  /* ---- Polaroid eject ---- */
  document.querySelectorAll(".polaroid").forEach((p) => {
    p.addEventListener("click", () => {
      const img = p.querySelector("img");
      const cap = p.querySelector("figcaption");
      if (!img) return;
      ejectImg.src = img.src;
      ejectImg.alt = img.alt || "";
      ejectCap.textContent = (cap?.textContent || "SOLO") + " · EJECTED";
      ejectLayer.hidden = false;
      beep(220, 0.08, "triangle", 0.04);
      setTimeout(() => beep(330, 0.06, "square", 0.03), 80);
    });
  });
  function closeEject() {
    ejectLayer.hidden = true;
  }
  ejectClose.addEventListener("click", closeEject);
  ejectLayer.addEventListener("click", (e) => {
    if (e.target === ejectLayer) closeEject();
  });

  /* ---- Karaoke lyric ---- */
  kLines.forEach((line, i) => {
    line.addEventListener("click", () => {
      kLines.forEach((l) => l.classList.remove("active"));
      line.classList.add("active");
      kBar.style.width = `${((i + 1) / kLines.length) * 100}%`;
      beep(440 + i * 60, 0.07, "sine", 0.035);
    });
  });

  /* ---- Poll (localStorage) ---- */
  const POLL_KEY = "kahuan-crt-poll-v1";
  function loadPoll() {
    try {
      return JSON.parse(localStorage.getItem(POLL_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function savePoll(data) {
    localStorage.setItem(POLL_KEY, JSON.stringify(data));
  }
  function renderPoll() {
    const data = loadPoll();
    const opts = ["A", "B", "C", "D"];
    const total = opts.reduce((s, k) => s + (data[k] || 0), 0);
    if (!data.picked) {
      pollResult.hidden = true;
      return;
    }
    pollResult.hidden = false;
    pollResult.innerHTML = opts
      .map((k) => {
        const n = data[k] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return `<div class="poll-bar-row"><span>${k}</span><div class="poll-bar-track"><div class="poll-bar-fill" style="width:${pct}%"></div></div><span>${pct}%</span></div>`;
      })
      .join("") + `<p style="margin-top:8px;opacity:.7">本地票数合计 ${total} · 仅存本机</p>`;
    poll.querySelectorAll(".poll-opts button").forEach((b) => {
      b.classList.toggle("picked", b.dataset.opt === data.picked);
    });
  }
  poll?.querySelectorAll(".poll-opts button").forEach((b) => {
    b.addEventListener("click", () => {
      const data = loadPoll();
      if (data.picked) {
        // allow re-pick: decrement old
        if (data[data.picked]) data[data.picked]--;
      }
      const opt = b.dataset.opt;
      data[opt] = (data[opt] || 0) + 1;
      data.picked = opt;
      savePoll(data);
      renderPoll();
      beep(520, 0.06);
    });
  });
  renderPoll();

  /* ---- Phosphor cursor trail ---- */
  const trailCanvas = document.getElementById("phosphorTrail");
  const tctx = trailCanvas.getContext("2d");
  const dots = [];
  function resizeTrail() {
    trailCanvas.width = window.innerWidth * devicePixelRatio;
    trailCanvas.height = window.innerHeight * devicePixelRatio;
    trailCanvas.style.width = window.innerWidth + "px";
    trailCanvas.style.height = window.innerHeight + "px";
    tctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  resizeTrail();
  window.addEventListener("resize", resizeTrail);

  let mx = 0, my = 0;
  window.addEventListener("pointermove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    document.body.style.setProperty("--cx", mx + "px");
    document.body.style.setProperty("--cy", my + "px");
    if (!document.body.classList.contains("touch-mode")) {
      dots.push({ x: mx, y: my, life: 1 });
      if (dots.length > 40) dots.shift();
    }
  });

  function drawTrail() {
    tctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.life -= 0.035;
      if (d.life <= 0) continue;
      const g = tctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 8);
      g.addColorStop(0, `rgba(57,255,20,${d.life * 0.7})`);
      g.addColorStop(1, "rgba(57,255,20,0)");
      tctx.fillStyle = g;
      tctx.beginPath();
      tctx.arc(d.x, d.y, 8, 0, Math.PI * 2);
      tctx.fill();
    }
    while (dots.length && dots[0].life <= 0) dots.shift();
    requestAnimationFrame(drawTrail);
  }
  drawTrail();

  /* ---- VHS noise canvas ---- */
  const noiseCanvas = document.getElementById("vhsNoise");
  const nctx = noiseCanvas.getContext("2d");
  function resizeNoise() {
    noiseCanvas.width = 160;
    noiseCanvas.height = 120;
  }
  resizeNoise();
  function drawNoise() {
    const w = noiseCanvas.width;
    const h = noiseCanvas.height;
    const img = nctx.createImageData(w, h);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 40;
    }
    nctx.putImageData(img, 0, 0);
    // occasional tear line
    if (Math.random() < 0.08) {
      const y = (Math.random() * h) | 0;
      nctx.fillStyle = "rgba(255,43,214,0.35)";
      nctx.fillRect(0, y, w, 2);
    }
    setTimeout(() => requestAnimationFrame(drawNoise), 80);
  }
  drawNoise();

  /* ---- Boot ---- */
  updateUI();
})();
