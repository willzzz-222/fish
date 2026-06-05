(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const timeEl = document.getElementById("time");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlayText");
  const overlayButton = document.getElementById("overlayButton");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const themeToggle = document.getElementById("themeToggle");

  const width = canvas.width;
  const height = canvas.height;
  const horizon = 148;
  const waterTop = horizon + 18;
  const gameLength = 60;
  const fishTypes = [
    { kind: "鲭鱼", points: 10, color: "#ffd26a", fin: "#ff9f40", speed: [80, 120], size: [28, 40] },
    { kind: "红鲷", points: 18, color: "#ff8f7d", fin: "#f05252", speed: [95, 135], size: [24, 34] },
    { kind: "海豚鱼", points: 30, color: "#91f2c9", fin: "#2bc2a1", speed: [110, 160], size: [22, 30] },
    { kind: "金枪鱼", points: 45, color: "#7cc7ff", fin: "#3d8ddd", speed: [135, 180], size: [18, 26] }
  ];

  const state = {
    running: false,
    timeLeft: gameLength,
    score: 0,
    combo: 1,
    bestCombo: 1,
    fish: [],
    ripples: [],
    particles: [],
    lastFrame: 0,
    fishSpawnTimer: 0,
    hook: {
      x: width * 0.5,
      depth: 0,
      targetDepth: 0,
      castPower: 0,
      autoReel: false,
      caughtFish: null,
      swingTime: 0
    }
  };

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function syncHud() {
    scoreEl.textContent = String(state.score);
    comboEl.textContent = "x" + String(state.combo);
    timeEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
  }

  function resetGame() {
    state.running = false;
    state.timeLeft = gameLength;
    state.score = 0;
    state.combo = 1;
    state.bestCombo = 1;
    state.fish = [];
    state.ripples = [];
    state.particles = [];
    state.fishSpawnTimer = 0;
    state.hook.x = width * 0.5;
    state.hook.depth = 0;
    state.hook.targetDepth = 0;
    state.hook.castPower = 0;
    state.hook.autoReel = false;
    state.hook.caughtFish = null;
    state.hook.swingTime = 0;
    syncHud();
  }

  function startGame() {
    resetGame();
    state.running = true;
    overlay.classList.remove("visible");
  }

  function endGame() {
    state.running = false;
    overlay.classList.add("visible");
    overlayText.textContent =
      "本局得分 " +
      state.score +
      "，最高连击 x" +
      state.bestCombo +
      "。这是纯静态版本，适合直接部署到 Cloudflare Pages。";
    overlayButton.textContent = "再来一局";
  }

  function spawnFish() {
    const spec = pick(fishTypes);
    const dir = Math.random() > 0.5 ? 1 : -1;
    const size = rand(spec.size[0], spec.size[1]);
    const speed = rand(spec.speed[0], spec.speed[1]) * dir;
    state.fish.push({
      kind: spec.kind,
      points: spec.points,
      color: spec.color,
      fin: spec.fin,
      size: size,
      x: dir === 1 ? -size * 2 : width + size * 2,
      y: rand(waterTop + 48, height - 72),
      vx: speed,
      wobble: rand(0, Math.PI * 2),
      depthBob: rand(8, 18),
      caught: false
    });
  }

  function addRipple(x, y, boost) {
    state.ripples.push({ x: x, y: y, radius: 8, speed: boost || 76, alpha: 0.38 });
  }

  function addBurst(text, x, y, color) {
    for (let i = 0; i < 12; i += 1) {
      state.particles.push({
        x: x,
        y: y,
        vx: rand(-50, 50),
        vy: rand(-110, -25),
        life: 0.9,
        text: i === 0 ? text : "",
        color: color
      });
    }
  }

  function castHook(clientX) {
    if (!state.running || state.hook.autoReel) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * width;
    state.hook.x = Math.max(46, Math.min(width - 46, localX));
    state.hook.targetDepth = rand(180, height - waterTop - 54);
    state.hook.castPower = 1;
    addRipple(state.hook.x, waterTop, 110);
  }

  function updateHook(dt) {
    state.hook.swingTime += dt;
    if (!state.running) {
      return;
    }
    if (state.hook.autoReel) {
      state.hook.depth -= 260 * dt;
      if (state.hook.caughtFish) {
        state.hook.caughtFish.x = state.hook.x;
        state.hook.caughtFish.y = waterTop + state.hook.depth;
      }
      if (state.hook.depth <= 0) {
        state.hook.depth = 0;
        if (state.hook.caughtFish) {
          state.score += state.hook.caughtFish.points * state.combo;
          state.combo = Math.min(state.combo + 1, 9);
          state.bestCombo = Math.max(state.bestCombo, state.combo);
          addBurst(
            "+" + state.hook.caughtFish.points * state.combo,
            state.hook.x,
            horizon + 24,
            state.hook.caughtFish.color
          );
          state.fish = state.fish.filter((fish) => fish !== state.hook.caughtFish);
          state.hook.caughtFish = null;
          syncHud();
        }
        state.hook.autoReel = false;
      }
      return;
    }
    if (state.hook.castPower > 0) {
      state.hook.depth += 280 * dt;
      if (state.hook.depth >= state.hook.targetDepth) {
        state.hook.castPower = 0;
      }
    } else if (state.hook.depth > 0) {
      state.hook.depth -= 175 * dt;
      if (state.hook.depth <= 0) {
        state.hook.depth = 0;
        state.combo = 1;
        syncHud();
      }
    }
  }

  function updateFish(dt) {
    for (const fish of state.fish) {
      fish.wobble += dt * 4;
      if (!fish.caught) {
        fish.x += fish.vx * dt;
        fish.y += Math.sin(fish.wobble) * fish.depthBob * dt;
      }
    }
    state.fish = state.fish.filter((fish) => fish.x > -150 && fish.x < width + 150);
    if (!state.running) {
      return;
    }
    state.fishSpawnTimer -= dt;
    if (state.fishSpawnTimer <= 0 && state.fish.length < 9) {
      spawnFish();
      state.fishSpawnTimer = rand(0.35, 0.9);
    }
    if (state.hook.autoReel) {
      return;
    }
    const hookX = state.hook.x;
    const hookY = waterTop + state.hook.depth;
    for (const fish of state.fish) {
      if (fish.caught) {
        continue;
      }
      const dx = fish.x - hookX;
      const dy = fish.y - hookY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < fish.size * 0.7 && state.hook.depth > 24) {
        fish.caught = true;
        state.hook.autoReel = true;
        state.hook.caughtFish = fish;
        addBurst(fish.kind, fish.x, fish.y - 18, fish.color);
        addRipple(fish.x, fish.y, 140);
        break;
      }
    }
  }

  function updateFx(dt) {
    state.ripples.forEach((ripple) => {
      ripple.radius += ripple.speed * dt;
      ripple.alpha -= dt * 0.34;
    });
    state.ripples = state.ripples.filter((ripple) => ripple.alpha > 0);
    state.particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 130 * dt;
      particle.life -= dt;
    });
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, horizon);
    gradient.addColorStop(0, getComputedStyle(document.body).getPropertyValue("--bg-top").trim());
    gradient.addColorStop(1, "rgba(255, 233, 181, 0.88)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, horizon);
    ctx.fillStyle = "rgba(255,255,255,0.46)";
    ctx.beginPath();
    ctx.arc(148, 86, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(0, horizon - 10, width, 10);
  }

  function drawWater() {
    const waterGradient = ctx.createLinearGradient(0, waterTop, 0, height);
    waterGradient.addColorStop(0, getComputedStyle(document.body).getPropertyValue("--water-a").trim());
    waterGradient.addColorStop(1, getComputedStyle(document.body).getPropertyValue("--water-b").trim());
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterTop, width, height - waterTop);
    for (let i = 0; i < 18; i += 1) {
      const x = i * 60 + ((state.lastFrame / 26) % 60);
      const y = waterTop + 20 + Math.sin((state.lastFrame / 500) + i) * 8;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 26, Math.PI, 0);
      ctx.stroke();
    }
    state.ripples.forEach((ripple) => {
      ctx.strokeStyle = "rgba(255,255,255," + ripple.alpha + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawPier() {
    ctx.fillStyle = "#7a4c2d";
    ctx.fillRect(0, horizon - 18, width, 18);
    ctx.fillStyle = "#5f381d";
    for (let i = 0; i < width; i += 72) {
      ctx.fillRect(i + 18, horizon - 18, 12, 40);
    }
  }

  function drawFish(fish) {
    ctx.save();
    ctx.translate(fish.x, fish.y);
    if (fish.vx <= 0) {
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, fish.size, fish.size * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-fish.size, 0);
    ctx.lineTo(-fish.size - fish.size * 0.8, -fish.size * 0.45);
    ctx.lineTo(-fish.size - fish.size * 0.8, fish.size * 0.45);
    ctx.closePath();
    ctx.fillStyle = fish.fin;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-fish.size * 0.1, -fish.size * 0.2);
    ctx.lineTo(fish.size * 0.2, -fish.size * 0.75);
    ctx.lineTo(fish.size * 0.56, -fish.size * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(fish.size * 0.42, -fish.size * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24313e";
    ctx.beginPath();
    ctx.arc(fish.size * 0.5, -fish.size * 0.1, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHook() {
    const rodTopX = width * 0.5 + Math.sin(state.hook.swingTime * 1.4) * 16;
    const rodTopY = 36;
    const hookY = waterTop + state.hook.depth;
    ctx.strokeStyle = "rgba(245, 250, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rodTopX, rodTopY);
    ctx.lineTo(state.hook.x, hookY);
    ctx.stroke();
    ctx.strokeStyle = "#d9f4ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.5 - 10, 24);
    ctx.quadraticCurveTo(width * 0.5 + 10, 0, width * 0.5 + 48, 36);
    ctx.stroke();
    ctx.strokeStyle = "#ffefcb";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.hook.x, hookY, 10, 0.4, Math.PI * 1.4);
    ctx.stroke();
  }

  function drawParticles() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 18px 'Segoe UI'";
    for (const particle of state.particles) {
      if (particle.text) {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillText(particle.text, particle.x, particle.y);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life * 0.9;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawPrompt() {
    if (!state.running) {
      return;
    }
    if (state.hook.depth === 0 && !state.hook.autoReel) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 20px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.fillText("点击或触摸海面抛钩", width * 0.5, height - 28);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawSky();
    drawWater();
    drawPier();
    state.fish.forEach(drawFish);
    drawHook();
    drawParticles();
    drawPrompt();
  }

  function frame(timestamp) {
    if (!state.lastFrame) {
      state.lastFrame = timestamp;
    }
    const dt = Math.min(0.032, (timestamp - state.lastFrame) / 1000);
    state.lastFrame = timestamp;
    if (state.running) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        syncHud();
        endGame();
      }
    }
    updateHook(dt);
    updateFish(dt);
    updateFx(dt);
    syncHud();
    draw();
    requestAnimationFrame(frame);
  }

  function onInteract(event) {
    if (event.target.closest("button")) {
      return;
    }
    const point = event.touches ? event.touches[0] : event;
    castHook(point.clientX);
  }

  overlayButton.addEventListener("click", startGame);
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", onInteract);
  canvas.addEventListener("touchstart", onInteract, { passive: true });
  themeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark");
    themeToggle.textContent = document.body.classList.contains("dark") ? "昼" : "夜";
  });

  resetGame();
  requestAnimationFrame(frame);
})();
