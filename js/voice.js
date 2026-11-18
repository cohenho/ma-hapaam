// Speech to text with the browser's own recogniser (Web Speech API, Hebrew).
// Nothing is recorded or saved: the browser turns speech into text, and only
// the text lands in the text box, where it can be edited.

const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;

  const MIC = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>`;

  function html() {
    return `
      <div class="recorder" data-state="idle">
        <button class="rec-btn" type="button" aria-label="${g("להתחיל להקליט", "להתחיל להקליט", "להתחיל להקליט")}">
          <span class="rec-ring" aria-hidden="true"></span>
          <span class="rec-mic">${MIC}</span>
          <span class="rec-waves" aria-hidden="true">${"<i></i>".repeat(9)}</span>
        </button>
        <p class="rec-hint" aria-live="polite"></p>
      </div>`;
  }

  const HINTS = {
    idle: () => `${g("לחצי", "לחץ", "לחצו")} כדי להתחיל להקליט`,
    listening: () => `${g("מקשיבה", "מקשיבה", "מקשיבה")}… ${g("לחצי", "לחץ", "לחצו")} שוב כדי לסיים`,
    done: () => `${g("אפשר לתקן את הטקסט, או ללחוץ שוב ולהוסיף", "אפשר לתקן את הטקסט, או ללחוץ שוב ולהוסיף", "אפשר לתקן את הטקסט, או ללחוץ שוב ולהוסיף")}`,
  };

  // Ask nicely, once, before the browser's own microphone question.
  // onOk runs inside the "הבנתי" tap itself: iPhone only lets a page listen when
  // listening starts directly from a tap, not a moment later.
  function explainMic(onOk) {
    if (Store.state.micExplained) { onOk(); return; }
    new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "install";
      box.innerHTML = `
        <div class="install-card mic-card" role="dialog" aria-modal="true" aria-labelledby="mic-title">
          <div class="mic-badge">${MIC}</div>
          <h2 id="mic-title">רגע לפני שמקליטים</h2>
          <p class="install-intro">אני צריכה את המיקרופון רק כדי להפוך את מה ${g("שתגידי", "שתגיד", "שתגידו")} לטקסט.
            <b>ההקלטה עצמה לא נשמרת</b>, ואף אחד לא שומע אותה. נשמר רק הטקסט, ואפשר לתקן אותו.</p>
          <p class="install-intro">מיד יופיע חלון של הטלפון שמבקש רשות. ${g("לחצי", "לחץ", "לחצו")} שם <b>"אפשר"</b>.</p>
          <button class="stamp stamp-red mic-ok" style="width:100%">הבנתי, ${g("בואי", "בוא", "בואו")} נקליט</button>
          <button class="card-link mic-no">לא עכשיו</button>
        </div>`;
      document.body.appendChild(box);
      requestAnimationFrame(() => box.classList.add("show"));
      const done = (ok) => {
        if (ok) { Store.state.micExplained = true; Store.save(); onOk(); }
        box.classList.remove("show");
        setTimeout(() => box.remove(), 300);
        resolve(ok);
      };
      box.querySelector(".mic-ok").addEventListener("click", () => done(true));
      box.querySelector(".mic-no").addEventListener("click", () => done(false));
    });
  }

  // Wire a recorder (made by html()) to a textarea.
  // onChange(state) is told "listening" / "done" / "failed" so the screen can adapt.
  function attach(recorder, textarea, onChange = () => {}) {
    const btn = recorder.querySelector(".rec-btn");
    const hint = recorder.querySelector(".rec-hint");
    let rec = null, listening = false, committed = "", restarts = 0, stopTimer = null;

    const setState = (state, message) => {
      recorder.dataset.state = state;
      hint.textContent = message || (HINTS[state] ? HINTS[state]() : "");
      btn.setAttribute("aria-label", state === "listening" ? "לסיים את ההקלטה" : "להתחיל להקליט");
    };
    setState("idle");

    const join = (...parts) => parts.map((p) => p.trim()).filter(Boolean).join(" ");

    function begin() {
      rec = new SR();
      rec.lang = "he-IL";
      rec.continuous = true;
      rec.interimResults = true;
      let finals = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const piece = e.results[i][0].transcript;
          if (e.results[i].isFinal) finals = join(finals, piece);
          else interim = join(interim, piece);
        }
        textarea.value = join(committed, finals, interim);
        textarea.dispatchEvent(new Event("input"));
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        listening = false;
        if (restarts > 0) {
          // an automatic restart after a pause was refused: just stop, keep the text
          setState(textarea.value.trim() ? "done" : "idle");
          onChange("done");
          return;
        }
        const installed = window.navigator.standalone === true;
        const why = {
          "not-allowed": `הטלפון לא נתן רשות למיקרופון. אפשר לאשר ב: הגדרות ← אפליקציות ← Safari ← מיקרופון ← "שאל" או "אפשר".`,
          "service-not-allowed": installed
            ? `באפליקציה שנפתחת מהמסך הבית, האייפון לא מאפשר הקלטה. אפשר לפתוח את האתר ב-Safari כדי להקליט, או להקליד.`
            : `זיהוי הדיבור של האייפון כבוי. אפשר להדליק ב: הגדרות ← כללי ← מקלדת ← "הפעלת הכתבה".`,
        }[e.error] || `ההקלטה לא הצליחה הפעם. אפשר לנסות שוב, או להקליד.`;
        setState("failed", `${why} בינתיים אפשר להקליד, או ללחוץ על המיקרופון שבמקלדת. (קוד: ${e.error})`);
        onChange("failed");
      };
      rec.onend = () => {
        committed = textarea.value;
        // Phones stop listening after a short silence; carry on until you press stop.
        if (listening && restarts < 30) { restarts++; try { begin(); return; } catch { /* fall through */ } }
        if (recorder.dataset.state === "listening") {
          listening = false;
          setState(textarea.value.trim() ? "done" : "idle");
          onChange("done");
        }
      };
      rec.start();
    }

    function start() {
      committed = textarea.value;
      restarts = 0;
      listening = true;
      setState("listening");
      onChange("listening");
      try { begin(); }
      catch {
        listening = false;
        setState("failed", "ההקלטה לא זמינה כאן. אפשר להקליד, או ללחוץ על המיקרופון שבמקלדת.");
        onChange("failed");
        return;
      }
      clearTimeout(stopTimer);
      stopTimer = setTimeout(stop, 3 * 60 * 1000); // no endless recordings
    }

    function stop() {
      clearTimeout(stopTimer);
      listening = false;
      if (rec) try { rec.stop(); } catch { /* already stopped */ }
      setState(textarea.value.trim() ? "done" : "idle");
      onChange("done");
    }

    btn.addEventListener("click", () => (listening ? stop() : explainMic(start)));
    return { stop: () => listening && stop() };
  }

  return { supported, html, attach };
})();
