/**
 * 词途 - TOEFL 词汇学习伙伴 v2
 * 艾宾浩斯复习 · 游戏化 · 正向心理循环
 */

const STORAGE_KEY = "toefl_vocab_buddy_v2";
const STORAGE_KEY_V1 = "toefl_vocab_buddy_v1";
const USERS_KEY = "toefl_users";
const CURRENT_USER_KEY = "toefl_current_user";

/* === 用户系统 === */
let currentUser = null;
let userState = null;

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw || null;
  } catch (_) {
    return null;
  }
}

function setCurrentUser(username) {
  if (username) {
    localStorage.setItem(CURRENT_USER_KEY, username);
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

function getUserStateKey(username) {
  return `toefl_state_${username}`;
}

function loadUserState(username) {
  try {
    const raw = localStorage.getItem(getUserStateKey(username));
    if (raw) {
      const s = { ...defaultState(), ...JSON.parse(raw) };
      if (!s.wordSRS) s.wordSRS = {};
      return s;
    }
  } catch (_) {}
  return defaultState();
}

function saveUserState(username, userState) {
  localStorage.setItem(getUserStateKey(username), JSON.stringify(userState));
}

function register(username, password) {
  const users = getUsers();
  if (users[username]) {
    return { success: false, message: "用户名已存在" };
  }
  users[username] = { password, isMember: false, registeredAt: new Date().toISOString() };
  saveUsers(users);
  const initialState = defaultState();
  saveUserState(username, initialState);
  return { success: true };
}

function login(username, password) {
  const users = getUsers();
  if (!users[username]) {
    return { success: false, message: "用户不存在" };
  }
  if (users[username].password !== password) {
    return { success: false, message: "密码错误" };
  }
  currentUser = { username, isMember: users[username].isMember };
  userState = loadUserState(username);
  setCurrentUser(username);
  return { success: true };
}

function logout() {
  if (currentUser && userState) {
    saveUserState(currentUser.username, userState);
  }
  currentUser = null;
  userState = null;
  setCurrentUser(null);
  showAuthScreen();
}

function showAuthScreen() {
  document.getElementById("authOverlay").classList.remove("hidden");
  document.getElementById("mainApp").classList.add("hidden");
}

function showMainApp() {
  document.getElementById("authOverlay").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  state = userState;
  updateProgressUI();
  updateGamificationUI();
  renderBadges();
  renderWordList();
}

function initAuthEvents() {
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const goToRegister = document.getElementById("goToRegister");
  const goToLogin = document.getElementById("goToLogin");
  const userBtn = document.getElementById("userBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userModal = document.getElementById("userModal");

  if (goToRegister) {
    goToRegister.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("loginForm").classList.add("hidden");
      document.getElementById("registerForm").classList.remove("hidden");
    });
  }

  if (goToLogin) {
    goToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("registerForm").classList.add("hidden");
      document.getElementById("loginForm").classList.remove("hidden");
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const username = document.getElementById("loginUsername").value.trim();
      const password = document.getElementById("loginPassword").value;
      
      if (!username || !password) {
        showToast("请填写用户名和密码");
        return;
      }
      
      const result = login(username, password);
      if (result.success) {
        showToast("登录成功！");
        document.getElementById("displayUsername").textContent = username;
        document.getElementById("displayRole").textContent = currentUser.isMember ? "会员用户" : "普通用户";
        showMainApp();
      } else {
        showToast(result.message);
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", () => {
      const username = document.getElementById("registerUsername").value.trim();
      const password = document.getElementById("registerPassword").value;
      const passwordConfirm = document.getElementById("registerPasswordConfirm").value;
      
      if (!username || !password) {
        showToast("请填写用户名和密码");
        return;
      }
      
      if (password !== passwordConfirm) {
        showToast("两次密码输入不一致");
        return;
      }
      
      const result = register(username, password);
      if (result.success) {
        showToast("注册成功！请登录");
        document.getElementById("registerForm").classList.add("hidden");
        document.getElementById("loginForm").classList.remove("hidden");
        document.getElementById("loginUsername").value = username;
        document.getElementById("loginPassword").value = password;
      } else {
        showToast(result.message);
      }
    });
  }

  if (userBtn) {
    userBtn.addEventListener("click", () => {
      if (currentUser) {
        document.getElementById("displayUsername").textContent = currentUser.username;
        document.getElementById("displayRole").textContent = currentUser.isMember ? "会员用户" : "普通用户";
      }
      userModal.classList.remove("hidden");
    });
  }

  if (userModal) {
    userModal.addEventListener("click", (e) => {
      if (e.target === userModal) {
        userModal.classList.add("hidden");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      userModal.classList.add("hidden");
      logout();
      showToast("已退出登录");
    });
  }
}

/** 复习间隔（天）：对应 24h内、一周内、7天、14天巩固 */
const SRS_INTERVALS = [1, 3, 7, 14, 30];
const QUIZ_INTERVAL_DAYS = 7;
const XP_MASTER = 10;
const XP_REVIEW = 15;
const XP_CHECKIN = 5;
const XP_QUIZ = 20;
const XP_GAME = 8;
const XP_PER_LEVEL = 100;

const BADGES = {
  first_word: { icon: "🌱", name: "初识一词" },
  streak_3: { icon: "🔥", name: "连续3天" },
  streak_7: { icon: "⭐", name: "连续7天" },
  review_10: { icon: "🧠", name: "复习达人" },
  quiz_pass: { icon: "🎯", name: "周测及格" },
  xp_100: { icon: "💎", name: "百点经验" },
  game_50: { icon: "🎮", name: "闯关高手" },
};

const TOEFL_WORDS = [
  "abundant", "accumulate", "acute", "advocate", "ambiguous", "analogy",
  "anticipate", "arbitrary", "assert", "assess", "attribute", "authentic",
  "bias", "capacity", "coherent", "commence", "compensate", "component",
  "comprehensive", "concept", "conclude", "conduct", "conflict", "consent",
  "consequence", "considerable", "consistent", "constant", "constitute",
  "contrast", "contribute", "controversy", "conventional", "convince",
  "cooperate", "criteria", "crucial", "culture", "decline", "deduce",
  "define", "demonstrate", "deny", "derive", "device", "distinct",
  "distribute", "diverse", "domestic", "dominate", "duration", "dynamic",
  "economy", "element", "eliminate", "emerge", "emphasis", "empirical",
  "enable", "encounter", "enhance", "ensure", "entity", "environment",
  "equate", "equivalent", "establish", "estimate", "ethic", "evaluate",
  "eventual", "evident", "evolve", "exceed", "exclude", "exhibit",
  "expand", "expert", "explicit", "exploit", "export", "expose",
  "external", "facilitate", "factor", "feature", "finance", "flexible",
  "focus", "format", "formula", "foundation", "framework", "function",
  "fundamental", "furthermore", "generate", "generation", "globe", "grant",
  "guarantee", "guideline", "hence", "hypothesis", "identical", "identify",
  "illustrate", "impact", "implement", "implicit", "imply", "impose",
  "incentive", "incorporate", "index", "indicate", "individual", "induce",
  "inevitable", "infer", "infrastructure", "inherent", "initial", "initiate",
  "innovate", "insight", "inspect", "instance", "institute", "integrate",
  "integrity", "intelligence", "intense", "interact", "intermediate",
  "internal", "interpret", "interval", "intervene", "invest", "investigate",
  "involve", "isolate", "justify", "label", "layer", "lecture", "legal",
  "liberal", "license", "likewise", "link", "locate", "logic", "maintain",
  "manifest", "manipulate", "manual", "margin", "mature", "maximize",
  "mechanism", "mediate", "mental", "method", "migrate", "minimal", "minor",
  "mode", "modify", "monitor", "motive", "mutual", "negate", "network",
  "neutral", "nevertheless", "notion", "objective", "oblige", "obtain",
  "obvious", "occupy", "occur", "offset", "ongoing", "option", "orient",
  "outcome", "output", "overall", "overlap", "overseas", "panel", "parallel",
  "parameter", "participate", "partner", "passive", "perceive", "persist",
  "perspective", "phase", "phenomenon", "philosophy", "physical", "policy",
  "portion", "pose", "positive", "potential", "precede", "precise",
  "predict", "predominant", "preliminary", "presume", "previous", "primary",
  "principal", "principle", "prior", "priority", "proceed", "process",
  "professional", "prohibit", "project", "promote", "proportion", "prospect",
  "protocol", "psychology", "publication", "publish", "purchase", "pursue",
  "qualify", "quality", "quarter", "radical", "random", "range", "ratio",
  "rational", "react", "recover", "refine", "reflect", "reform", "regime",
  "region", "register", "regulate", "reinforce", "reject", "relevant", "rely",
  "require", "research", "resolve", "resource", "respond", "restore",
  "restrain", "restrict", "retain", "reveal", "revenue", "reverse", "revise",
  "rigid", "role", "route", "scenario", "schedule", "scheme", "scope",
  "section", "sector", "secure", "seek", "select", "sequence", "series",
  "shift", "significant", "similar", "simulate", "site", "sole", "somewhat",
  "source", "specific", "specify", "sphere", "stable", "statistic", "status",
  "straightforward", "strategy", "stress", "structure", "style", "submit",
  "subsequent", "subsidy", "substitute", "successor", "sufficient", "summary",
  "supplement", "survey", "survive", "suspend", "sustain", "symbol", "target",
  "technical", "technique", "technology", "temporary", "tense", "terminate",
  "theme", "theory", "thereby", "thesis", "topic", "trace", "tradition",
  "transfer", "transform", "transit", "transmit", "transport", "trend",
  "trigger", "ultimate", "undergo", "underlie", "undertake", "uniform",
  "unify", "unique", "utilize", "valid", "variable", "vary", "vehicle",
  "version", "via", "violate", "virtual", "visible", "vision", "visual",
  "volume", "voluntary", "welfare", "whereas", "whereby", "widespread",
  "willing", "withdraw", "witness", "workshop", "worldwide",
];

const MOOD_MESSAGES = {
  great: "状态很棒！今天可多学几个新词，或挑战周测～",
  ok: "平稳就好：新词 + 复习昨天到期的词，就是科学节奏。",
  tired: "累了就少学新词，优先复习到期的（24 小时内最容易忘）。",
  anxious: "别硬背。完成 1 个复习 + 打卡，就算打破「不想背」的循环。",
};

let state = loadState();
let currentWord = "";
let currentAudioUrl = "";
let wordHistory = [];
let historyIndex = -1;
let activeListTab = "mastered";
let studyMode = "learn"; // learn | review
let quizSession = null;
let totalReviewDone = 0;

function defaultState() {
  return {
    wordSRS: {},
    mastered: [],
    favorites: [],
    definitionsCache: {},
    dailyGoal: 3,
    todayDate: "",
    todayNewCount: 0,
    todayReviewCount: 0,
    streak: 0,
    lastStudyDate: "",
    checkedInToday: false,
    lastCheckInDate: "",
    mood: "",
    moodDate: "",
    xp: 0,
    badges: [],
    lastQuizDate: "",
    quizBestScore: 0,
    gameBestScore: 0,
    totalReviews: 0,
    listOrder: { mastered: [], favorites: [] },
  };
}

function migrateFromV1() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return;
    const old = JSON.parse(raw);
    const s = defaultState();
    s.mastered = old.mastered || [];
    s.favorites = old.favorites || [];
    s.dailyGoal = old.dailyGoal ?? 3;
    s.streak = old.streak ?? 0;
    s.mood = old.mood || "";
    s.moodDate = old.moodDate || "";
    s.listOrder = old.listOrder || s.listOrder;
    const today = todayStr();
    for (const w of s.mastered) {
      s.wordSRS[w] = {
        learnedAt: today,
        stage: 0,
        nextReview: addDays(today, 1),
        reviewCount: 0,
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (_) {}
}

function loadState() {
  migrateFromV1();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = { ...defaultState(), ...JSON.parse(raw) };
      if (!s.wordSRS) s.wordSRS = {};
      return s;
    }
  } catch (_) {}
  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (currentUser && userState) {
    userState = state;
    saveUserState(currentUser.username, userState);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function resetTodayIfNeeded() {
  const t = todayStr();
  if (state.todayDate !== t) {
    const prev = state.todayDate;
    if (prev && state.checkedInToday) {
      const diff = daysBetween(prev, t);
      if (diff === 1) state.streak += 1;
      else if (diff > 1) state.streak = 0;
    }
    state.todayDate = t;
    state.todayNewCount = 0;
    state.todayReviewCount = 0;
    state.checkedInToday = false;
  }
}

function getLevel() {
  return Math.floor(state.xp / XP_PER_LEVEL) + 1;
}

function addXP(amount, reason) {
  const prevLevel = getLevel();
  state.xp += amount;
  const newLevel = getLevel();
  saveState();
  updateGamificationUI();
  if (newLevel > prevLevel) {
    showToast(`🎉 升级！Lv.${newLevel} — ${reason}`);
    celebrateLevelUp();
  } else if (reason) {
    showToast(`+${amount} XP · ${reason}`);
  }
  checkBadges();
}

function celebrateLevelUp() {
  const bar = document.getElementById("xpBar");
  bar.classList.add("level-up");
  setTimeout(() => bar.classList.remove("level-up"), 600);
}

function awardBadge(id) {
  if (state.badges.includes(id)) return;
  state.badges.push(id);
  saveState();
  renderBadges();
  const b = BADGES[id];
  if (b) showToast(`🏅 解锁徽章：${b.icon} ${b.name}`);
}

function checkBadges() {
  if (state.mastered.length >= 1) awardBadge("first_word");
  if (state.streak >= 3) awardBadge("streak_3");
  if (state.streak >= 7) awardBadge("streak_7");
  if (state.totalReviews >= 10) awardBadge("review_10");
  if (state.xp >= 100) awardBadge("xp_100");
  if (state.gameBestScore >= 50) awardBadge("game_50");
}

function getDueWords() {
  const today = todayStr();
  return Object.entries(state.wordSRS)
    .filter(([, r]) => r.nextReview <= today)
    .map(([w]) => w)
    .sort((a, b) => state.wordSRS[a].nextReview.localeCompare(state.wordSRS[b].nextReview));
}

function getDaysToQuiz() {
  if (!state.lastQuizDate) {
    return state.mastered.length >= 5 ? 0 : "—";
  }
  const elapsed = daysBetween(state.lastQuizDate, todayStr());
  const left = Math.max(0, QUIZ_INTERVAL_DAYS - elapsed);
  return left;
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function cacheDefinition(word, entry) {
  for (const m of entry.meanings || []) {
    const def = m.definitions?.[0]?.definition;
    if (def) {
      state.definitionsCache[word] = def.slice(0, 120);
      return;
    }
  }
}

function pickRandomNewWord() {
  const learned = new Set(Object.keys(state.wordSRS));
  const pool = TOEFL_WORDS.filter((w) => !learned.has(w));
  if (pool.length === 0) {
    return TOEFL_WORDS[Math.floor(Math.random() * TOEFL_WORDS.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function fetchDictionary(word) {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!res.ok) throw new Error("词典未找到该词");
  const data = await res.json();
  return data[0];
}

function setStudyMode(mode) {
  studyMode = mode;
  document.getElementById("learnModeTag").textContent =
    mode === "review" ? "📆 艾宾浩斯复习" : "✨ 新词学习";
  document.getElementById("learnActions").classList.toggle("hidden", mode === "review");
  document.getElementById("reviewActions").classList.toggle("hidden", mode !== "review");
}

function renderWordCard(entry, word) {
  const card = document.getElementById("wordCard");
  card.classList.remove("loading", "error");

  let phonetic = "";
  currentAudioUrl = "";
  if (entry.phonetics) {
    for (const p of entry.phonetics) {
      if (p.text && !phonetic) phonetic = p.text;
      if (p.audio && !currentAudioUrl) currentAudioUrl = p.audio;
    }
  }

  const srs = state.wordSRS[word];
  const srsHint =
    srs && studyMode === "learn"
      ? `<p class="srs-hint">下次复习：${srs.nextReview}（第 ${srs.stage + 1} 轮）</p>`
      : studyMode === "review"
        ? `<p class="srs-hint">⚡ 黄金复习时刻：学后 24 小时内 / 第一周内最容易忘</p>`
        : "";

  const meanings = (entry.meanings || [])
    .slice(0, 3)
    .map((m) => {
      const def = m.definitions?.[0];
      if (!def) return "";
      const ex = def.example
        ? `<p class="example">${escapeHtml(def.example)}</p>`
        : "";
      return `
        <div class="meaning-block">
          <span class="part-of-speech">${escapeHtml(m.partOfSpeech || "")}</span>
          <span>${escapeHtml(def.definition || "")}</span>
          ${ex}
        </div>`;
    })
    .join("");

  card.innerHTML = `
    <h3 class="word-title">${escapeHtml(word)}</h3>
    ${phonetic ? `<p class="phonetic">${escapeHtml(phonetic)}</p>` : ""}
    ${srsHint}
    ${meanings || "<p>暂无释义</p>"}
  `;

  const audioBtns = ["playAudioBtn", "playAudioReviewBtn"];
  audioBtns.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !currentAudioUrl;
  });
  document.getElementById("favoriteBtn").disabled = false;
  document.getElementById("masteredBtn").disabled =
    studyMode === "review" || !!state.wordSRS[word];
  updateFavoriteButton();
}

async function loadWord(word, pushHistory = true) {
  const card = document.getElementById("wordCard");
  card.classList.add("loading");
  card.innerHTML = '<p class="loading-text">正在从词典 API 获取…</p>';
  ["playAudioBtn", "favoriteBtn", "masteredBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  currentWord = word;
  const due = getDueWords();
  if (due.includes(word)) setStudyMode("review");
  else if (studyMode === "review" && !due.includes(word)) setStudyMode("learn");

  try {
    const entry = await fetchDictionary(word);
    cacheDefinition(word, entry);
    saveState();
    renderWordCard(entry, word);
    if (pushHistory) {
      if (historyIndex < wordHistory.length - 1) {
        wordHistory = wordHistory.slice(0, historyIndex + 1);
      }
      wordHistory.push(word);
      historyIndex = wordHistory.length - 1;
    }
    updateNavButtons();
  } catch (e) {
    card.classList.add("error");
    card.innerHTML = `<p class="loading-text">加载失败：${escapeHtml(e.message)}</p>`;
  }
}

function updateNavButtons() {
  document.getElementById("prevWordBtn").disabled = historyIndex <= 0;
  document.getElementById("nextWordBtn").disabled =
    historyIndex >= wordHistory.length - 1;
}

function updateFavoriteButton() {
  const btn = document.getElementById("favoriteBtn");
  if (!btn) return;
  const fav = state.favorites.includes(currentWord);
  btn.textContent = fav ? "★ 已收藏" : "☆ 收藏";
}

function updateProgressUI() {
  resetTodayIfNeeded();
  document.getElementById("streakCount").textContent = state.streak;
  document.getElementById("todayCount").textContent = state.todayNewCount;
  document.getElementById("goalDisplay").textContent = state.dailyGoal;
  document.getElementById("dailyGoal").value = state.dailyGoal;
  document.getElementById("goalOutput").textContent = state.dailyGoal;

  const pct = Math.min(100, (state.todayNewCount / state.dailyGoal) * 100);
  document.getElementById("dailyProgressBar").style.width = `${pct}%`;

  const due = getDueWords();
  document.getElementById("dueReviewCount").textContent = due.length;
  document.getElementById("todayReviewDone").textContent = state.todayReviewCount;
  const dtq = getDaysToQuiz();
  document.getElementById("daysToQuiz").textContent =
    dtq === "—" ? "—" : dtq === 0 ? "今天!" : `${dtq}天`;

  document.getElementById("startReviewBtn").disabled = due.length === 0;
  renderDueList(due);

  const enc = document.getElementById("encouragement");
  const parts = [];
  if (state.todayNewCount >= state.dailyGoal) {
    parts.push("🎉 今日新词目标已达成！");
    enc.classList.add("done");
  } else {
    enc.classList.remove("done");
    parts.push(`新词还差 ${state.dailyGoal - state.todayNewCount} 个`);
  }
  if (due.length > 0) {
    parts.push(`另有 ${due.length} 个词到期复习（艾宾浩斯关键期）`);
  } else if (state.mastered.length > 0) {
    parts.push("暂无到期复习，真棒！");
  }
  enc.textContent = parts.join(" · ");

  updateFlywheelMsg();
  updateQuizBanner();
  updateCheckInButton();
}

function updateFlywheelMsg() {
  const el = document.getElementById("flywheelMsg");
  if (state.todayReviewCount > 0 && state.todayNewCount > 0) {
    el.textContent =
      "你今天同时完成了新词 + 复习——正在打破「记不住→不想背」的死循环！";
  } else if (getDueWords().length > 0) {
    el.textContent =
      `有 ${getDueWords().length} 个词处于遗忘高危期（24h～一周内），优先复习比硬背新词更有效。`;
  } else {
    el.textContent =
      "科学节奏：第 1 天学新词 → 第 2 天复习昨天 → 每 7 天周测。用对方法，才会有成就感。";
  }
}

function updateGamificationUI() {
  document.getElementById("levelDisplay").textContent = getLevel();
  document.getElementById("xpDisplay").textContent = state.xp;
  const inLevel = state.xp % XP_PER_LEVEL;
  document.getElementById("xpBar").style.width = `${(inLevel / XP_PER_LEVEL) * 100}%`;
  document.getElementById("gameScore").innerHTML =
    `最高分：<strong>${state.gameBestScore}</strong>`;
  renderBadges();
}

function renderBadges() {
  const row = document.getElementById("badgeRow");
  if (!state.badges.length) {
    row.innerHTML = '<span class="badge-empty">完成学习解锁徽章</span>';
    return;
  }
  row.innerHTML = state.badges
    .map((id) => {
      const b = BADGES[id];
      return b
        ? `<span class="badge" title="${escapeHtml(b.name)}">${b.icon}</span>`
        : "";
    })
    .join("");
}

function renderDueList(due) {
  const ul = document.getElementById("dueReviewList");
  if (!due.length) {
    ul.innerHTML = '<li class="due-empty">暂无到期复习 — 明天再来看看</li>';
    return;
  }
  ul.innerHTML = due
    .slice(0, 8)
    .map((w) => {
      const r = state.wordSRS[w];
      return `<li><button type="button" class="due-word-btn" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button><span class="due-meta">→${r.nextReview}</span></li>`;
    })
    .join("");
  ul.querySelectorAll(".due-word-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setStudyMode("review");
      loadWord(btn.dataset.word, true);
    });
  });
}

function updateCheckInButton() {
  const btn = document.getElementById("checkInBtn");
  if (state.checkedInToday) {
    btn.textContent = "✓ 已打卡";
    btn.disabled = true;
    btn.classList.remove("pulse");
  } else {
    btn.textContent = "今日打卡";
    btn.disabled = false;
    btn.classList.add("pulse");
  }
}

function doCheckIn() {
  resetTodayIfNeeded();
  if (state.checkedInToday) return;
  state.checkedInToday = true;
  state.lastCheckInDate = todayStr();
  if (state.streak === 0) state.streak = 1;
  state.lastStudyDate = todayStr();
  addXP(XP_CHECKIN, "每日打卡");
  saveState();
  updateCheckInButton();
  updateProgressUI();
}

function markMastered() {
  if (!currentWord || state.wordSRS[currentWord]) {
    showToast("已在复习计划中，请用「复习」模式巩固");
    return;
  }
  const today = todayStr();
  state.mastered.push(currentWord);
  state.wordSRS[currentWord] = {
    learnedAt: today,
    stage: 0,
    nextReview: addDays(today, SRS_INTERVALS[0]),
    reviewCount: 0,
  };
  if (!state.listOrder.mastered.includes(currentWord)) {
    state.listOrder.mastered.push(currentWord);
  }
  resetTodayIfNeeded();
  state.todayNewCount += 1;
  state.lastStudyDate = today;
  addXP(XP_MASTER, "掌握新词");
  saveState();
  updateProgressUI();
  renderWordList();
  document.getElementById("masteredBtn").disabled = true;
}

function reviewPass() {
  if (!currentWord || !state.wordSRS[currentWord]) return;
  const rec = state.wordSRS[currentWord];
  const today = todayStr();
  rec.stage = Math.min(rec.stage + 1, SRS_INTERVALS.length - 1);
  rec.nextReview = addDays(today, SRS_INTERVALS[rec.stage]);
  rec.reviewCount += 1;
  state.totalReviews += 1;
  resetTodayIfNeeded();
  state.todayReviewCount += 1;
  addXP(XP_REVIEW, "复习成功");
  saveState();
  updateProgressUI();
  renderWordList();
  const due = getDueWords();
  if (due.length > 0) {
    setStudyMode("review");
    loadWord(due[0], true);
  } else {
    setStudyMode("learn");
    showToast("全部复习完成！去学学新词吧");
  }
}

function reviewFail() {
  if (!currentWord || !state.wordSRS[currentWord]) return;
  const rec = state.wordSRS[currentWord];
  const today = todayStr();
  rec.stage = 0;
  rec.nextReview = addDays(today, 1);
  saveState();
  updateProgressUI();
  showToast("没关系，明天再复习——遗忘是正常的，复习就是对抗它");
}

function toggleFavorite() {
  if (!currentWord) return;
  const idx = state.favorites.indexOf(currentWord);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    state.listOrder.favorites = state.listOrder.favorites.filter((w) => w !== currentWord);
    showToast("已取消收藏");
  } else {
    state.favorites.push(currentWord);
    if (!state.listOrder.favorites.includes(currentWord)) {
      state.listOrder.favorites.push(currentWord);
    }
    showToast("已加入收藏");
  }
  saveState();
  updateFavoriteButton();
  renderWordList();
}

function getOrderedList(key) {
  if (key === "srs") {
    return Object.keys(state.wordSRS).sort((a, b) =>
      state.wordSRS[a].nextReview.localeCompare(state.wordSRS[b].nextReview)
    );
  }
  const items = key === "mastered" ? state.mastered : state.favorites;
  const order = state.listOrder[key] || [];
  const sorted = [...items].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  state.listOrder[key] = sorted;
  return sorted;
}

function renderWordList() {
  const ul = document.getElementById("wordList");
  const key = activeListTab;
  const words = getOrderedList(key);

  if (words.length === 0) {
    const msgs = {
      mastered: "还没有掌握的词",
      favorites: "收藏夹是空的",
      srs: "暂无复习计划",
    };
    ul.innerHTML = `<li style="cursor:default;opacity:0.7">${msgs[key]}</li>`;
    return;
  }

  ul.innerHTML = words
    .map((w) => {
      if (key === "srs") {
        const r = state.wordSRS[w];
        const due = r.nextReview <= todayStr() ? " 🔴" : "";
        return `<li data-word="${escapeHtml(w)}"><span>${escapeHtml(w)}</span><span class="due-meta">${r.nextReview}${due}</span></li>`;
      }
      return `
    <li draggable="true" data-word="${escapeHtml(w)}">
      <span class="drag-handle">⋮⋮</span>
      <span>${escapeHtml(w)}</span>
      <button type="button" class="remove" data-word="${escapeHtml(w)}">×</button>
    </li>`;
    })
    .join("");

  if (key !== "srs") {
    ul.querySelectorAll("li[draggable]").forEach(bindDrag);
    ul.querySelectorAll("button.remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeWord(btn.dataset.word, key);
      });
    });
  }

  ul.querySelectorAll("li[data-word]").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.classList?.contains("remove")) return;
      const w = li.dataset.word;
      if (getDueWords().includes(w)) setStudyMode("review");
      else setStudyMode("learn");
      loadWord(w, true);
    });
  });
}

function removeWord(w, key) {
  if (key === "mastered") {
    state.mastered = state.mastered.filter((x) => x !== w);
    state.listOrder.mastered = state.listOrder.mastered.filter((x) => x !== w);
    delete state.wordSRS[w];
  } else {
    state.favorites = state.favorites.filter((x) => x !== w);
    state.listOrder.favorites = state.listOrder.favorites.filter((x) => x !== w);
  }
  saveState();
  renderWordList();
  updateProgressUI();
  if (w === currentWord) updateFavoriteButton();
  showToast("已移除");
}

let dragSrc = null;

function bindDrag(li) {
  li.addEventListener("dragstart", () => {
    dragSrc = li;
    li.classList.add("dragging");
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
  });
  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (li !== dragSrc) li.classList.add("drag-over");
  });
  li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("drag-over");
    if (!dragSrc || dragSrc === li || activeListTab === "srs") return;
    const key = activeListTab;
    const order = getOrderedList(key);
    const from = order.indexOf(dragSrc.dataset.word);
    const to = order.indexOf(li.dataset.word);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragSrc.dataset.word);
    state.listOrder[key] = order;
    saveState();
    renderWordList();
  });
}

function updateQuizBanner() {
  const banner = document.getElementById("quizBanner");
  const days = getDaysToQuiz();
  const ready =
    state.mastered.length >= 5 &&
    (days === 0 || days === "—" || !state.lastQuizDate);
  banner.classList.toggle("hidden", !ready);
}

function buildQuizQuestions(count = 5) {
  const words = state.mastered.filter((w) => state.definitionsCache[w]);
  if (words.length < 4) return null;
  const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((word) => {
    const correct = state.definitionsCache[word];
    const others = words
      .filter((w) => w !== word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => state.definitionsCache[w]);
    const options = [correct, ...others].sort(() => Math.random() - 0.5);
    return { word, correct, options };
  });
}

function startWeeklyQuiz() {
  const questions = buildQuizQuestions(5);
  if (!questions) {
    showToast("至少需要 4 个有释义的已学词，请先多掌握几个");
    return;
  }
  quizSession = { questions, index: 0, score: 0 };
  document.getElementById("quizBanner").classList.add("hidden");
  document.getElementById("quizPanel").classList.remove("hidden");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizSession.questions[quizSession.index];
  document.getElementById("quizIndex").textContent = quizSession.index + 1;
  document.getElementById("quizTotal").textContent = quizSession.questions.length;
  document.getElementById("quizQuestion").textContent = `「${q.word}」的意思是？`;
  document.getElementById("quizFeedback").textContent = "";
  const opts = document.getElementById("quizOptions");
  opts.innerHTML = q.options
    .map(
      (opt, i) =>
        `<button type="button" class="quiz-opt" data-idx="${i}">${escapeHtml(opt)}</button>`
    )
    .join("");
  opts.querySelectorAll(".quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => answerQuiz(btn, q));
  });
}

function answerQuiz(btn, q) {
  const chosen = q.options[parseInt(btn.dataset.idx, 10)];
  const correct = chosen === q.correct;
  document.querySelectorAll(".quiz-opt").forEach((b) => (b.disabled = true));
  const fb = document.getElementById("quizFeedback");
  if (correct) {
    quizSession.score += 1;
    fb.textContent = "✓ 正确！+20 XP";
    fb.className = "quiz-feedback ok";
    addXP(XP_QUIZ, "周测答对");
  } else {
    fb.textContent = `✗ 正确答案：${q.correct.slice(0, 80)}…`;
    fb.className = "quiz-feedback fail";
  }
  setTimeout(() => {
    quizSession.index += 1;
    if (quizSession.index >= quizSession.questions.length) finishQuiz();
    else renderQuizQuestion();
  }, 1200);
}

function finishQuiz() {
  const score = quizSession.score;
  const total = quizSession.questions.length;
  state.lastQuizDate = todayStr();
  if (score >= Math.ceil(total * 0.6)) awardBadge("quiz_pass");
  if (score > state.quizBestScore) state.quizBestScore = score;
  saveState();
  document.getElementById("quizPanel").classList.add("hidden");
  quizSession = null;
  updateQuizBanner();
  updateProgressUI();
  showToast(`周测结束：${score}/${total}。7 天后再战！`);
}

let gameScore = 0;

function startGame() {
  const words = state.mastered.filter((w) => state.definitionsCache[w]);
  if (words.length < 4) {
    showToast("请先掌握至少 4 个词再闯关");
    return;
  }
  gameScore = 0;
  document.getElementById("gameArea").classList.remove("hidden");
  nextGameRound(words);
}

function nextGameRound(words) {
  const word = words[Math.floor(Math.random() * words.length)];
  const correct = state.definitionsCache[word];
  const others = words
    .filter((w) => w !== word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => state.definitionsCache[w]);
  const options = [correct, ...others].sort(() => Math.random() - 0.5);

  document.getElementById("gameWord").textContent = word;
  const opts = document.getElementById("gameOptions");
  opts.innerHTML = options
    .map(
      (opt, i) =>
        `<button type="button" class="quiz-opt" data-idx="${i}">${escapeHtml(opt.slice(0, 90))}${opt.length > 90 ? "…" : ""}</button>`
    )
    .join("");
  opts.querySelectorAll(".quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chosen = options[parseInt(btn.dataset.idx, 10)];
      if (chosen === correct) {
        gameScore += 1;
        addXP(XP_GAME, "闯关答对");
        if (gameScore > state.gameBestScore) {
          state.gameBestScore = gameScore;
          saveState();
          updateGamificationUI();
        }
        nextGameRound(words);
      } else {
        showToast(`闯关结束，得分 ${gameScore}`);
        document.getElementById("gameArea").classList.add("hidden");
        checkBadges();
      }
    });
  });
}

async function fetchAdvice() {
  const box = document.getElementById("adviceText");
  box.textContent = "正在获取建议…";
  try {
    const res = await fetch("https://api.adviceslip.com/advice");
    const data = await res.json();
    box.textContent =
      "【微习惯】" + (data.slip?.advice || data.advice || "先复习 1 个到期词");
  } catch {
    box.textContent = "【微习惯】今天：1 个新词 + 复习昨天到期的词。";
  }
}

async function fetchRelaxImage() {
  const wrap = document.getElementById("relaxImageWrap");
  wrap.innerHTML = '<p class="placeholder">加载中…</p>';
  try {
    const res = await fetch("https://dog.ceo/api/breeds/image/random");
    const data = await res.json();
    if (data.message) {
      wrap.innerHTML = `<img src="${data.message}" alt="治愈图" />`;
    } else throw new Error();
  } catch {
    wrap.innerHTML = '<p class="placeholder">加载失败</p>';
  }
}

function selectMood(mood) {
  state.mood = mood;
  state.moodDate = todayStr();
  saveState();
  document.querySelectorAll(".mood-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.mood === mood);
  });
  const fb = document.getElementById("moodFeedback");
  fb.hidden = false;
  fb.textContent = MOOD_MESSAGES[mood] || "";
}

function restoreMoodUI() {
  if (state.moodDate === todayStr() && state.mood) selectMood(state.mood);
}

function clearAllData() {
  if (!confirm("确定清空所有学习记录？")) return;
  state = defaultState();
  state.todayDate = todayStr();
  saveState();
  document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"));
  document.getElementById("moodFeedback").hidden = true;
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("gameArea").classList.add("hidden");
  setStudyMode("learn");
  updateProgressUI();
  updateGamificationUI();
  renderWordList();
  showToast("已清空");
}

function playAudio() {
  if (currentAudioUrl) new Audio(currentAudioUrl).play();
}

function initEvents() {
  document.getElementById("randomWordBtn").addEventListener("click", () => {
    setStudyMode("learn");
    loadWord(pickRandomNewWord(), true);
  });
  document.getElementById("prevWordBtn").addEventListener("click", () => {
    if (historyIndex > 0) loadWord(wordHistory[--historyIndex], false);
  });
  document.getElementById("nextWordBtn").addEventListener("click", () => {
    if (historyIndex < wordHistory.length - 1)
      loadWord(wordHistory[++historyIndex], false);
  });
  document.getElementById("playAudioBtn").addEventListener("click", playAudio);
  document.getElementById("playAudioReviewBtn").addEventListener("click", playAudio);
  document.getElementById("favoriteBtn").addEventListener("click", toggleFavorite);
  document.getElementById("masteredBtn").addEventListener("click", markMastered);
  document.getElementById("reviewPassBtn").addEventListener("click", reviewPass);
  document.getElementById("reviewFailBtn").addEventListener("click", reviewFail);
  document.getElementById("checkInBtn").addEventListener("click", doCheckIn);
  document.getElementById("startReviewBtn").addEventListener("click", () => {
    const due = getDueWords();
    if (due.length) {
      setStudyMode("review");
      loadWord(due[0], true);
    }
  });
  document.getElementById("startQuizBtn").addEventListener("click", startWeeklyQuiz);
  document.getElementById("startGameBtn").addEventListener("click", startGame);
  document.getElementById("fetchAdviceBtn").addEventListener("click", fetchAdvice);
  document.getElementById("fetchRelaxBtn").addEventListener("click", fetchRelaxImage);
  document.getElementById("clearAllBtn").addEventListener("click", clearAllData);

  document.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectMood(btn.dataset.mood));
  });

  const goalInput = document.getElementById("dailyGoal");
  const goalOutput = document.getElementById("goalOutput");
  goalInput.addEventListener("input", () => {
    goalOutput.textContent = goalInput.value;
  });
  document.getElementById("saveGoalBtn").addEventListener("click", () => {
    state.dailyGoal = parseInt(goalInput.value, 10);
    saveState();
    updateProgressUI();
    showToast(`每日新词目标：${state.dailyGoal}（建议第2天复习前一天）`);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeListTab = tab.dataset.tab;
      renderWordList();
    });
  });
}

function init() {
  initAuthEvents();
  
  const savedUser = getCurrentUser();
  if (savedUser) {
    const users = getUsers();
    if (users[savedUser]) {
      currentUser = { username: savedUser, isMember: users[savedUser].isMember };
      userState = loadUserState(savedUser);
      state = userState;
      document.getElementById("displayUsername").textContent = savedUser;
      document.getElementById("displayRole").textContent = currentUser.isMember ? "会员用户" : "普通用户";
      showMainApp();
      resetTodayIfNeeded();
      setStudyMode("learn");
      updateProgressUI();
      updateGamificationUI();
      restoreMoodUI();
      renderWordList();
      initEvents();
      loadWord(pickRandomNewWord(), true);
      return;
    }
  }
  
  showAuthScreen();
}

init();
