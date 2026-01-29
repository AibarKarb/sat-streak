const $ = (id) => document.getElementById(id);

let QUESTIONS = [];
let current = null;
let locked = false;

const STORAGE_KEY = "brainsprint_v1";

function todayKey() {
  const d = new Date();
  // yyyy-mm-dd local
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      xp: 0,
      solved: 0,
      streak: 0,
      lastSolvedDay: null,
      seenIds: []
    };
  }
  try { return JSON.parse(raw); } catch { return { xp:0, solved:0, streak:0, lastSolvedDay:null, seenIds:[] }; }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateHUD(state) {
  $("xp").textContent = state.xp;
  $("solved").textContent = state.solved;
  $("streak").textContent = state.streak;
}

function pickNext(state) {
  // avoid repeats until we've seen all
  let unused = QUESTIONS.filter(q => !state.seenIds.includes(q.id));
  if (unused.length === 0) {
    state.seenIds = [];
    saveState(state);
    unused = QUESTIONS.slice();
  }
  const q = unused[Math.floor(Math.random() * unused.length)];
  state.seenIds.push(q.id);
  saveState(state);
  return q;
}

let t = null;
let secondsLeft = 0;

function startTimer() {
  clearInterval(t);
  secondsLeft = 120; // можно менять
  $("timer").textContent = secondsLeft;
  t = setInterval(() => {
    if (locked) return;
    secondsLeft--;
    $("timer").textContent = secondsLeft;
    if (secondsLeft <= 0) {
      clearInterval(t);
      // auto fail, но мягко: просто показать правильный и дать Next
      lockAndReveal(null, true);
    }
  }, 1000);
}

function renderQuestion(q) {
  current = q;
  locked = false;
  $("title").textContent = "Sprint";
  
  $("question").innerHTML =
  (q.passage ? `<div style="opacity:.85;margin-bottom:10px">${q.passage}</div>` : "")
  + `<div>${q.question}</div>`;

  
  $("meta").textContent = `${q.section.toUpperCase()} • lvl ${q.difficulty}`;
  $("hint").textContent = "Tap an answer. Keep the streak alive.";

  const wrap = $("choices");
  wrap.innerHTML = "";

  Object.entries(q.choices).forEach(([key, text]) => {
  const btn = document.createElement("button");
  btn.textContent = `${key}. ${text}`;
  btn.onclick = () => lockAndReveal(key, false);
  wrap.appendChild(btn);
});


  startTimer();
}

function updateStreak(state) {
  const today = todayKey();
  const last = state.lastSolvedDay;

  if (last === today) {
    // already solved today, streak unchanged
    return;
  }

  if (!last) {
    state.streak = 1;
  } else {
    // check if last == yesterday
    const lastDate = new Date(last + "T00:00:00");
    const todayDate = new Date(today + "T00:00:00");
    const diffDays = Math.round((todayDate - lastDate) / (1000*60*60*24));

    if (diffDays === 1) state.streak += 1;
    else state.streak = 1; // missed days → reset
  }

  state.lastSolvedDay = today;
}

function lockAndReveal(selected, timeoutFail) {
  if (locked) return;
  locked = true;
  clearInterval(t);

  const state = loadState();

  const buttons = Array.from($("choices").querySelectorAll("button"));
  const correct = current.answer;

  buttons.forEach(btn => {
    if (btn.textContent.startsWith(correct + ".")) btn.classList.add("ok");
    if (selected && btn.textContent === selected && selected !== correct) btn.classList.add("bad");
    btn.disabled = true;
  });

  if (!timeoutFail && selected === correct) {
    // reward
    state.xp += 10 + (current.difficulty * 2);
    state.solved += 1;
    updateStreak(state);
    $("hint").textContent = "✅ Nice. Next one?";
  } else {
    // no streak update on wrong/timeout
    $("hint").textContent = timeoutFail ? `⏱ Time. Correct: ${correct}` : `❌ Correct: ${correct}`;
  }

  saveState(state);
  updateHUD(state);

  // auto next after a short pause
  setTimeout(() => {
    renderQuestion(pickNext(loadState()));
  }, 700);
}

async function init() {
  // PWA Service Worker
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  }

  const res = await fetch("./questions.json", { cache: "no-store" });
  QUESTIONS = await res.json();

  const state = loadState();
  updateHUD(state);

  $("skip").onclick = () => renderQuestion(pickNext(loadState()));
  $("reset").onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    updateHUD(loadState());
    renderQuestion(pickNext(loadState()));
  };

  renderQuestion(pickNext(state));
}

init();


