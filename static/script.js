(() => {
  const page = document.body.dataset.page;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const cardStage = $("#cardStage");
  const emptyState = $("#emptyState");
  const moodChips = $("#moodChips");
  const yearFrom = $("#yearFrom");
  const yearTo = $("#yearTo");

  const startBtn = $("#startBtn");
  const moreBtn = $("#moreBtn");
  const refillBtn = $("#refillBtn");
  const resetBtn = $("#resetBtn");
  const undoBtn = $("#undoBtn");

  const explainText = $("#explainText");
  const queueMeta = $("#queueMeta");
  const statMood = $("#statMood");
  const statLang = $("#statLang");
  const statYear = $("#statYear");
  const statPage = $("#statPage");

  const skipBtn = $("#skipBtn");
  const likeBtn = $("#likeBtn");
  const previewBtn = $("#previewBtn");

  // modal
  const modal = $("#modal");
  const modalBackdrop = $("#modalBackdrop");
  const modalClose = $("#modalClose");
  const modalTitle = $("#modalTitle");
  const modalMeta = $("#modalMeta");
  const modalPoster = $("#modalPoster");
  const modalLangBadge = $("#modalLangBadge");
  const modalOverview = $("#modalOverview");
  const trailerFrame = $("#trailerFrame");
  const noTrailer = $("#noTrailer");
  const modalLike = $("#modalLike");
  const modalSkip = $("#modalSkip");
  const providersRow = $("#providersRow");

  // drawer
  const drawer = $("#drawer");
  const drawerBackdrop = $("#drawerBackdrop");
  const drawerClose = $("#drawerClose");
  const watchlistBtn = $("#watchlistBtn");
  const watchlistCount = $("#watchlistCount");
  const watchlistItems = $("#watchlistItems");

  // watchlist page
  const watchlistGrid = $("#watchlistGrid");
  const watchlistEmpty = $("#watchlistEmpty");
  const openDrawerBtn = $("#openDrawerBtn");

  // skipped page
  const skippedGrid = $("#skippedGrid");
  const skippedEmpty = $("#skippedEmpty");
  const clearSkippedBtn = $("#clearSkippedBtn");

  // top page bits
  const loadTopBtn = $("#loadTopBtn");
  const nextTopBtn = $("#nextTopBtn");
  const topGrid = $("#topGrid");
  const topMeta = $("#topMeta");
  const searchBox = $("#searchBox");

  const IMG = (path, size="w780") =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : "";

  const FORCED_LANG_LABEL = "English";

  let selectedMood = "";
  let currentPage = 1;
  let totalPages = 1;

  let queue = [];
  let currentCard = null;
  let currentMovie = null;

  const undoStack = [];
  const taste = JSON.parse(localStorage.getItem("taste_profile") || "{}");

  let loadingMore = false;

  // =========================
  // ✅ GLOBAL COOLDOWN DEDUP
  // =========================
  const COOLDOWN_DAYS = 7;
  const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const SEEN_MAP_KEY = "seen_movie_map_v1";

  // seenMap: { "<movieId>": <timestamp_ms> }
  let seenMap = (() => {
    // migrate old "seen_movie_ids" into map once (backwards compatible)
    const old = JSON.parse(localStorage.getItem("seen_movie_ids") || "[]");
    const map = JSON.parse(localStorage.getItem(SEEN_MAP_KEY) || "{}");

    if (Array.isArray(old) && old.length && (!map || Object.keys(map).length === 0)) {
      const now = Date.now();
      old.slice(-1200).forEach(id => { map[String(id)] = now; });
      localStorage.setItem(SEEN_MAP_KEY, JSON.stringify(map));
      // keep old key but it won't be used anymore
    }
    return map || {};
  })();

  function pruneSeenMap() {
    const now = Date.now();
    let changed = false;

    // remove expired
    for (const [k, ts] of Object.entries(seenMap)) {
      const t = Number(ts);
      if (!Number.isFinite(t) || (now - t) > COOLDOWN_MS) {
        delete seenMap[k];
        changed = true;
      }
    }

    // limit size (keep most recent 2000)
    const keys = Object.keys(seenMap);
    if (keys.length > 2000) {
      const sorted = keys
        .map(k => [k, Number(seenMap[k])])
        .sort((a,b) => b[1] - a[1]);
      const keep = new Set(sorted.slice(0, 2000).map(x => x[0]));
      for (const k of keys) {
        if (!keep.has(k)) {
          delete seenMap[k];
          changed = true;
        }
      }
    }

    if (changed) localStorage.setItem(SEEN_MAP_KEY, JSON.stringify(seenMap));
  }

  function isInCooldown(id) {
    pruneSeenMap();
    const ts = Number(seenMap[String(id)]);
    if (!Number.isFinite(ts)) return false;
    return (Date.now() - ts) <= COOLDOWN_MS;
  }

  function markSeen(id) {
    seenMap[String(id)] = Date.now();
    localStorage.setItem(SEEN_MAP_KEY, JSON.stringify(seenMap));
  }

  function unmarkSeen(id) {
    delete seenMap[String(id)];
    localStorage.setItem(SEEN_MAP_KEY, JSON.stringify(seenMap));
  }

  function clearSeenCooldown() {
    seenMap = {};
    localStorage.removeItem(SEEN_MAP_KEY);
    // also clear legacy key so user truly resets
    localStorage.removeItem("seen_movie_ids");
  }

  // ---------------- taste helpers ----------------
  function persistTaste() {
    localStorage.setItem("taste_profile", JSON.stringify(taste));
  }
  function topLikedGenres(limit=5) {
    const pairs = Object.entries(taste)
      .map(([k,v]) => [Number(k), Number(v)])
      .filter(([k,v]) => Number.isFinite(k) && Number.isFinite(v))
      .sort((a,b) => b[1]-a[1]);
    return pairs.slice(0, limit).map(p => p[0]);
  }

  function yearRangeParams() {
    const yf = yearFrom ? yearFrom.value.trim() : "";
    const yt = yearTo ? yearTo.value.trim() : "";
    return { yf, yt };
  }

  function setExplain(text) {
    if (explainText) explainText.textContent = text || "—";
  }

  function setStats() {
    if (statMood) statMood.textContent = selectedMood || "—";
    if (statLang) statLang.textContent = FORCED_LANG_LABEL;

    if (statYear) {
      const { yf, yt } = yearRangeParams();
      statYear.textContent = (yf || yt) ? `${yf || "…"} → ${yt || "…"}`
                                       : "—";
    }

    if (statPage) statPage.textContent = `${currentPage} / ${totalPages}`;
    if (queueMeta) queueMeta.textContent = `Queue: ${queue.length}`;
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  }

  function showEmptyIfNeeded() {
    if (!emptyState) return;
    emptyState.style.display = (queue.length === 0 && !currentCard) ? "flex" : "none";
  }

  async function apiGet(url) {
    const res = await fetch(url);
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const msg = data?.detail || data?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body || {})
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return data;
  }

  // ---------- drawer watchlist ----------
  async function refreshWatchlist() {
    if (!watchlistItems || !watchlistCount) return;
    try {
      const data = await apiGet("/api/watchlist");
      const items = data.items || [];
      watchlistCount.textContent = String(items.length);

      watchlistItems.innerHTML = "";
      if (!items.length) {
        watchlistItems.innerHTML = `
          <div class="empty" style="height:auto; padding:24px 14px;">
            <div class="empty-title">No saved movies</div>
            <div class="muted">Swipe right to add to watchlist.</div>
          </div>`;
        return;
      }

      for (const m of items) {
        const thumb = IMG(m.poster_path, "w185");
        const el = document.createElement("div");
        el.className = "w-item";
        el.innerHTML = `
          <div class="w-thumb" style="background-image:url('${thumb}')"></div>
          <div class="w-meta">
            <div class="w-title">${escapeHtml(m.title)}</div>
            <div class="w-sub">⭐ ${round1(m.vote_average)} • EN</div>
            <div class="w-sub">${m.added_at || ""}</div>
          </div>
          <div class="w-actions">
            <button class="small-btn" data-remove="${m.id}">Remove</button>
          </div>
        `;
        watchlistItems.appendChild(el);
      }

      $$(".small-btn[data-remove]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = Number(btn.dataset.remove);
          await apiPost("/api/watchlist/remove", {id});
          await refreshWatchlist();
          if (page === "watchlist_page") await loadWatchlistPage();
        });
      });
    } catch {}
  }

  function openDrawer() {
    drawer?.classList.remove("hidden");
    drawer?.setAttribute("aria-hidden", "false");
    refreshWatchlist();
  }
  function closeDrawer() {
    drawer?.classList.add("hidden");
    drawer?.setAttribute("aria-hidden", "true");
  }

  // ---------- modal ----------
  async function openModal(movie) {
    currentMovie = movie;
    if (!modal) return;

    modalTitle.textContent = movie.title || "—";
    modalMeta.textContent = `${movie.release_date ? movie.release_date.slice(0,4) : "—"} • ⭐ ${round1(movie.vote_average)} • votes ${movie.vote_count || 0}`;
    if (modalPoster) modalPoster.src = IMG(movie.poster_path, "w500") || "";
    if (modalLangBadge) modalLangBadge.textContent = "EN";
    if (modalOverview) modalOverview.textContent = movie.overview || "No synopsis available.";

    if (trailerFrame) trailerFrame.src = "";
    noTrailer?.classList.add("hidden");
    if (providersRow) providersRow.textContent = "Loading…";

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    try {
      const t = await apiGet(`/api/trailer?id=${movie.id}`);
      if (t.youtube_key) {
        trailerFrame.src = `https://www.youtube.com/embed/${t.youtube_key}?autoplay=0&rel=0`;
        noTrailer?.classList.add("hidden");
      } else {
        noTrailer?.classList.remove("hidden");
      }
    } catch {
      noTrailer?.classList.remove("hidden");
    }

    try {
      const p = await apiGet(`/api/providers?id=${movie.id}&region=IN`);
      const list = p.providers || [];
      if (!providersRow) return;

      if (!list.length) {
        providersRow.innerHTML = `<span class="muted">Not listed for your region.</span>`;
        return;
      }

      providersRow.innerHTML = `
        <div class="providers-wrap">
          ${list.slice(0, 6).map(x => `
            <div class="provider-pill">
              <img class="provider-logo" src="${IMG(x.logo_path, "w92")}" alt="">
              <span>${escapeHtml(x.provider_name)}</span>
            </div>
          `).join("")}
        </div>
      `;
    } catch {
      if (providersRow) providersRow.innerHTML = `<span class="muted">Unable to fetch providers.</span>`;
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    if (trailerFrame) trailerFrame.src = "";
  }

  // ---------- swipe cards ----------
  function buildCard(movie, zIndex) {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.style.zIndex = String(zIndex);

    const bg = IMG(movie.backdrop_path || movie.poster_path, "w1280");
    const poster = IMG(movie.poster_path, "w500");
    const year = movie.release_date ? movie.release_date.slice(0,4) : "—";
    const rating = round1(movie.vote_average);

    const badgeClass = Number(rating) >= 7.8 ? "good" : Number(rating) >= 6.5 ? "warn" : "bad";

    card.innerHTML = `
      <div class="card-bg" style="background-image:url('${bg || poster}')"></div>
      <div class="card-content">
        <h2 class="card-title">${escapeHtml(movie.title || "Untitled")}</h2>
        <div class="card-meta">
          <span class="badge ${badgeClass}">⭐ ${rating}</span>
          <span class="badge">${year}</span>
          <span class="badge">EN</span>
        </div>
        <div class="card-actions-hint">
          <span class="hint">Tap to preview</span>
          <span class="hint">Drag to swipe</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      if (card.dataset.dragging === "1") return;
      openModal(movie);
    });

    attachSwipeHandlers(card);
    return card;
  }

  // ✅ Smart pull: try multiple pages before giving up
  async function pullUntilQueue({ minItems=10, maxPull=8 } = {}) {
    if (loadingMore) return;
    if (!selectedMood) return;

    loadingMore = true;
    try {
      let pulls = 0;
      let noAddStreak = 0;

      while (queue.length < minItems && pulls < maxPull) {
        const nextPage = currentPage + 1;
        currentPage = nextPage;

        const { added } = await fetchRecommendations({ append: true, silent: true });

        pulls += 1;

        if (!added) {
          noAddStreak += 1;
          if (noAddStreak >= 2) break; // stop if 2 pages add nothing
        } else {
          noAddStreak = 0;
        }

        // if backend gave total_pages, respect it (but don't block pulls early)
        if (totalPages && currentPage >= totalPages && noAddStreak >= 1) break;
      }
    } finally {
      loadingMore = false;
    }
  }

  async function mountNextCard() {
    if (!cardStage) return;

    // if queue empty, try to pull multiple pages automatically
    if (queue.length === 0) {
      await pullUntilQueue({ minItems: 12, maxPull: 10 });
    }

    const next = queue.shift();
    currentMovie = next || null;

    $$(".movie-card").forEach(el => el.remove());

    if (!next) {
      currentCard = null;
      setStats();
      showEmptyIfNeeded();

      // helpful message (no "wait a day" nonsense)
      setExplain(
        "No more matches for these filters right now. " +
        "Try widening Year Range, switching mood, or hit Reset to clear cooldown + swipe history."
      );
      return;
    }

    const peek = queue[0];

    const top = buildCard(next, 3);
    cardStage.appendChild(top);

    if (peek) {
      const under = buildCard(peek, 2);
      under.style.inset = "26px";
      under.style.opacity = "0.85";
      under.style.transform = "scale(.98)";
      under.style.pointerEvents = "none";
      cardStage.appendChild(under);
    }

    currentCard = top;
    setStats();
    showEmptyIfNeeded();

    // keep queue healthy in background (lightweight)
    if (queue.length <= 5) pullUntilQueue({ minItems: 12, maxPull: 4 });
  }

  async function logSkip(movie) {
    try {
      await apiPost("/api/swipe", {
        action: "skip",
        mood: selectedMood || null,
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        vote_average: movie.vote_average
      });
    } catch {}
  }

  async function swipeOut(direction) {
    if (!currentCard || !currentMovie) return;
    const card = currentCard;
    const movie = currentMovie;

    undoStack.push({ movie, dir: direction });
    if (undoStack.length > 25) undoStack.shift();

    // ✅ mark seen globally (cooldown)
    markSeen(movie.id);

    const x = direction === "right" ? 600 : -600;
    card.style.transform = `translateX(${x}px) rotate(${direction === "right" ? 18 : -18}deg)`;
    card.style.opacity = "0";

    setTimeout(async () => {
      card.remove();
      currentCard = null;

      if (direction === "right") {
        if (Array.isArray(movie.genre_ids)) {
          for (const g of movie.genre_ids) taste[g] = (taste[g] || 0) + 1;
          persistTaste();
          renderTasteDNA();
        }

        try {
          await apiPost("/api/watchlist/add", {
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
          });
          await refreshWatchlist();
        } catch {}
      } else {
        await logSkip(movie);
      }

      await mountNextCard();
    }, 180);
  }

  async function undoLast() {
    if (!undoStack.length) return;
    const last = undoStack.pop();
    const movie = last.movie;

    // ✅ undo cooldown mark so it can appear again immediately
    unmarkSeen(movie.id);

    if (last.dir === "right") {
      try {
        await apiPost("/api/watchlist/remove", { id: movie.id });
        await refreshWatchlist();
      } catch {}

      if (Array.isArray(movie.genre_ids)) {
        for (const g of movie.genre_ids) taste[g] = (taste[g] || 0) - 1;
        persistTaste();
        renderTasteDNA();
      }
    }

    queue.unshift(movie);
    await mountNextCard();
    setStats();
  }

  function attachSwipeHandlers(card) {
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;
    let dragging = false;

    const threshold = 110;

    const onDown = (clientX, clientY) => {
      dragging = true;
      card.dataset.dragging = "0";
      startX = clientX;
      startY = clientY;
      dx = 0; dy = 0;
      card.style.transition = "none";
    };

    const onMove = (clientX, clientY) => {
      if (!dragging) return;
      dx = clientX - startX;
      dy = clientY - startY;

      if (Math.abs(dx) > 6) card.dataset.dragging = "1";

      const rot = dx / 18;
      card.style.transform = `translateX(${dx}px) translateY(${dy * 0.05}px) rotate(${rot}deg)`;
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      card.style.transition = "transform .18s ease, opacity .18s ease";

      if (dx > threshold) return swipeOut("right");
      if (dx < -threshold) return swipeOut("left");

      card.style.transform = "translateX(0) rotate(0deg)";
      card.dataset.dragging = "0";
    };

    card.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", onUp);

    card.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      onDown(t.clientX, t.clientY);
    }, {passive:true});

    card.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, {passive:true});

    card.addEventListener("touchend", onUp);
  }

  // ---------- home fetch ----------
  async function loadMoods() {
    if (!moodChips) return;
    const data = await apiGet("/api/moods");
    const moods = data.moods || [];
    moodChips.innerHTML = "";

    moods.forEach(m => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = capitalize(m);
      chip.dataset.mood = m;
      chip.addEventListener("click", () => {
        selectedMood = m;
        $$(".chip").forEach(c => c.classList.toggle("active", c.dataset.mood === m));
        setExplain(`Mood set to "${m}". Hit Recommend to load movies.`);
        setStats();
      });
      moodChips.appendChild(chip);
    });
  }

  function buildRecommendUrl(pageNum) {
    const { yf, yt } = yearRangeParams();
    const liked = topLikedGenres(5);
    const likedStr = liked.length ? `&liked_genres=${encodeURIComponent(liked.join(","))}` : "";

    const yParams =
      `${yf ? `&year_from=${encodeURIComponent(yf)}` : ""}` +
      `${yt ? `&year_to=${encodeURIComponent(yt)}` : ""}`;

    return `/api/recommend?mood=${encodeURIComponent(selectedMood)}&page=${pageNum}${yParams}${likedStr}`;
  }

  async function fetchRecommendations({append=false, silent=false}={}) {
    if (!selectedMood) {
      if (!silent) setExplain("Pick a mood first.");
      return { added: 0 };
    }

    if (!append) {
      currentPage = 1;
      queue = [];
      currentCard = null;
      currentMovie = null;
      undoStack.length = 0;
      $$(".movie-card").forEach(el => el.remove());
    }

    try {
      const url = buildRecommendUrl(currentPage);
      const data = await apiGet(url);

      if (!silent) setExplain(data.explain || "");
      totalPages = data.total_pages || 1;
      currentPage = data.page || currentPage;

      const before = queue.length;

      const movies = (data.results || [])
        .filter(m => m && m.id && m.title)
        // ✅ global cooldown filter
        .filter(m => !isInCooldown(m.id));

      queue = queue.concat(movies);

      const added = queue.length - before;

      if (moreBtn) moreBtn.disabled = (totalPages ? currentPage >= totalPages : false);
      setStats();
      showEmptyIfNeeded();

      if (!queue.length && !currentCard && !silent) {
        setExplain(
          "No movies matched your filters (or they're in cooldown). " +
          "Try widening the year range, switching mood, or hit Reset."
        );
      }

      if (!currentCard) await mountNextCard();

      return { added };
    } catch (err) {
      if (!silent) {
        setExplain(`Recommend failed: ${err.message}. If TMDB is blocked on your network, run with VPN.`);
      }
      showEmptyIfNeeded();
      return { added: 0 };
    }
  }

  async function loadMore() {
    currentPage += 1;
    await fetchRecommendations({append:true});
    // if still small, try pulling again quietly
    if (queue.length < 8) pullUntilQueue({ minItems: 12, maxPull: 4 });
  }

  function resetAll() {
    selectedMood = "";
    currentPage = 1;
    totalPages = 1;
    queue = [];
    currentCard = null;
    currentMovie = null;
    undoStack.length = 0;

    // ✅ reset clears cooldown + swipe history
    clearSeenCooldown();

    if (yearFrom) yearFrom.value = "";
    if (yearTo) yearTo.value = "";

    $$(".chip").forEach(c => c.classList.remove("active"));
    setExplain("Reset done. Pick a mood and hit Recommend again.");
    $$(".movie-card").forEach(el => el.remove());
    if (moreBtn) moreBtn.disabled = true;

    setStats();
    showEmptyIfNeeded();
    renderTasteDNA();
  }

  // ---------- watchlist page ----------
  async function loadWatchlistPage() {
    const data = await apiGet("/api/watchlist");
    const items = data.items || [];

    if (!watchlistGrid || !watchlistEmpty) return;

    watchlistGrid.innerHTML = "";
    watchlistEmpty.classList.toggle("hidden", items.length > 0);

    for (const m of items) {
      const card = document.createElement("div");
      card.className = "grid-card";
      card.innerHTML = `
        <div class="grid-thumb" style="background-image:url('${IMG(m.poster_path, "w342")}')"></div>
        <div class="grid-info">
          <div class="grid-title">${escapeHtml(m.title || "Untitled")}</div>
          <div class="grid-meta">
            <span>EN</span>
            <span>⭐ ${round1(m.vote_average)}</span>
          </div>
        </div>
      `;
      card.addEventListener("click", () => openModal(m));
      watchlistGrid.appendChild(card);
    }
  }

  // ---------- skipped page ----------
  async function loadSkippedPage() {
    const data = await apiGet("/api/skipped");
    const items = data.items || [];

    if (!skippedGrid || !skippedEmpty) return;

    skippedGrid.innerHTML = "";
    skippedEmpty.classList.toggle("hidden", items.length > 0);

    for (const m of items) {
      const card = document.createElement("div");
      card.className = "grid-card";
      card.innerHTML = `
        <div class="grid-thumb" style="background-image:url('${IMG(m.poster_path, "w342")}')"></div>
        <div class="grid-info">
          <div class="grid-title">${escapeHtml(m.title || "Untitled")}</div>
          <div class="grid-meta">
            <span>${escapeHtml((m.mood || "skipped").toString())}</span>
            <span>⭐ ${round1(m.vote_average)}</span>
          </div>
        </div>
      `;
      card.addEventListener("click", () => openModal(m));
      skippedGrid.appendChild(card);
    }
  }

  // ---------- top page (kept) ----------
  let topPage = 1;
  let topTotal = 1;

  function buildTopUrl() {
    const yf = yearFrom ? yearFrom.value.trim() : "";
    const yt = yearTo ? yearTo.value.trim() : "";
    const q = searchBox ? searchBox.value.trim() : "";

    const yParams =
      `${yf ? `&year_from=${encodeURIComponent(yf)}` : ""}` +
      `${yt ? `&year_to=${encodeURIComponent(yt)}` : ""}`;

    if (q) return `/api/search?q=${encodeURIComponent(q)}&page=${topPage}${yParams}`;
    return `/api/toprated?page=${topPage}${yParams}`;
  }

  async function loadTopRated({replace=true}={}) {
    const data = await apiGet(buildTopUrl());
    topTotal = data.total_pages || 1;

    const movies = (data.results || []).filter(m => m && m.id);

    if (replace && topGrid) topGrid.innerHTML = "";

    movies.forEach(m => {
      const card = document.createElement("div");
      card.className = "grid-card";
      const thumb = IMG(m.poster_path, "w342");
      const year = m.release_date ? m.release_date.slice(0,4) : "—";
      const rating = round1(m.vote_average);

      card.innerHTML = `
        <div class="grid-thumb" style="background-image:url('${thumb}')"></div>
        <div class="grid-info">
          <div class="grid-title">${escapeHtml(m.title || "Untitled")}</div>
          <div class="grid-meta">
            <span>${year}</span>
            <span>⭐ ${rating}</span>
          </div>
        </div>
      `;
      card.addEventListener("click", () => openModal(m));
      topGrid?.appendChild(card);
    });

    if (topMeta) topMeta.textContent = `Top Rated • Page ${topPage} / ${topTotal} • English`;
    if (nextTopBtn) nextTopBtn.disabled = topPage >= topTotal;

    topGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- wiring ----------
  function wireCommon() {
    watchlistBtn?.addEventListener("click", openDrawer);
    drawerBackdrop?.addEventListener("click", closeDrawer);
    drawerClose?.addEventListener("click", closeDrawer);

    openDrawerBtn?.addEventListener("click", openDrawer);

    modalBackdrop?.addEventListener("click", closeModal);
    modalClose?.addEventListener("click", closeModal);
    modalSkip?.addEventListener("click", closeModal);

    modalLike?.addEventListener("click", async () => {
      if (!currentMovie) return;

      // ✅ add from modal should also mark seen cooldown
      markSeen(currentMovie.id);

      await apiPost("/api/watchlist/add", {
        id: currentMovie.id,
        title: currentMovie.title,
        poster_path: currentMovie.poster_path,
        vote_average: currentMovie.vote_average
      });
      await refreshWatchlist();
      if (page === "watchlist_page") await loadWatchlistPage();
      closeModal();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeDrawer();
      }
      if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) undoLast();
    });

    refreshWatchlist();
  }

  function wireHome() {
    startBtn?.addEventListener("click", () => fetchRecommendations({append:false}));
    moreBtn?.addEventListener("click", loadMore);
    refillBtn?.addEventListener("click", async () => {
      // keep your existing force refill behavior but smarter
      await pullUntilQueue({ minItems: 25, maxPull: 10 });
      setExplain(`Force refill done. Queue: ${queue.length}.`);
      setStats();
      showEmptyIfNeeded();
      if (!currentCard) await mountNextCard();
    });
    resetBtn?.addEventListener("click", resetAll);

    likeBtn?.addEventListener("click", () => swipeOut("right"));
    skipBtn?.addEventListener("click", () => swipeOut("left"));
    previewBtn?.addEventListener("click", () => currentMovie && openModal(currentMovie));

    undoBtn?.addEventListener("click", undoLast);

    yearFrom?.addEventListener("change", setStats);
    yearTo?.addEventListener("change", setStats);
  }

  function wireTop() {
    loadTopBtn?.addEventListener("click", async () => {
      topPage = 1;
      await loadTopRated({replace:true});
    });

    nextTopBtn?.addEventListener("click", async () => {
      if (topPage >= topTotal) return;
      topPage += 1;
      await loadTopRated({replace:true});
    });

    searchBox?.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        topPage = 1;
        await loadTopRated({replace:true});
      }
    });
  }

  function wireSkippedPage() {
    clearSkippedBtn?.addEventListener("click", async () => {
      await apiPost("/api/skipped/clear", {});
      await loadSkippedPage();
    });
  }

  // ---------- Taste DNA ----------
  const GENRE_NAMES = {
    28:"Action",12:"Adventure",16:"Animation",35:"Comedy",80:"Crime",99:"Documentary",
    18:"Drama",10751:"Family",14:"Fantasy",36:"History",27:"Horror",10402:"Music",
    9648:"Mystery",10749:"Romance",878:"Sci-Fi",10770:"TV Movie",53:"Thriller",
    10752:"War",37:"Western"
  };

  function renderTasteDNA(){
    const el = $("#tasteDNA");
    if (!el) return;

    const pairs = Object.entries(taste)
      .map(([k,v]) => [Number(k), Number(v)])
      .filter(([k,v]) => Number.isFinite(k) && Number.isFinite(v) && v > 0)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 5);

    if (!pairs.length){
      el.textContent = "No data yet — like a few movies.";
      return;
    }

    const total = pairs.reduce((s, [,v]) => s + v, 0) || 1;
    const lines = pairs.map(([gid, v]) => {
      const name = GENRE_NAMES[gid] || `Genre ${gid}`;
      const pct = Math.round((v / total) * 100);
      return `${name} • ${pct}%`;
    });

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${lines.map(x => `<div class="pill" style="display:inline-flex;">${x}</div>`).join("")}
        <div class="muted small" style="margin-top:6px;">
          Built from your likes. Used to re-rank inside the selected mood.
        </div>
      </div>
    `;
  }

  // ---------- utils ----------
  function capitalize(s){ return (s||"").charAt(0).toUpperCase() + (s||"").slice(1); }
  function round1(n){
    if (n === null || n === undefined) return "—";
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }
  function escapeHtml(str){
    return String(str||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ---------- init ----------
  (async function init(){
    wireCommon();

    if (page === "home") {
      await loadMoods();
      setStats();
      showEmptyIfNeeded();
      wireHome();
      renderTasteDNA();
    }

    if (page === "top") {
      wireTop();
    }

    if (page === "watchlist_page") {
      await loadWatchlistPage();
    }

    if (page === "skipped_page") {
      await loadSkippedPage();
      wireSkippedPage();
    }
  })();
})();
