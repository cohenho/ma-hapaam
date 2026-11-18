// "How to add to the home screen" — shown once, only on iPhone/iPad in the browser
// (not when the app is already opened from its home-screen icon).

const Install = (() => {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isInstalled = window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  const ink = "#3a2a1f", gold = "#c9962b", paper = "#fbf5ea", line = "#d9c8ac";

  // Step 1: Safari's bottom bar with the share button highlighted.
  const pic1 = `
    <svg viewBox="0 0 260 120" role="img" aria-label="כפתור השיתוף בתחתית Safari">
      <rect x="10" y="10" width="240" height="100" rx="16" fill="${paper}" stroke="${line}" stroke-width="2"/>
      <rect x="28" y="28" width="204" height="30" rx="15" fill="#efe5d4"/>
      <text x="130" y="48" font-size="13" text-anchor="middle" fill="#8a7563" font-family="Assistant, sans-serif">cohenho.github.io</text>
      <g fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M45 84l-8 8 8 8"/>
        <path d="M80 84l8 8-8 8"/>
        <rect x="183" y="80" width="22" height="22" rx="4"/><rect x="189" y="86" width="22" height="22" rx="4"/>
      </g>
      <circle cx="130" cy="92" r="21" fill="none" stroke="${gold}" stroke-width="3.5"/>
      <g fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M123 90h-3v12h20v-12h-3"/><path d="M130 97V80"/><path d="M125 85l5-5 5 5"/>
      </g>
    </svg>`;

  // Step 2: the share sheet with "הוספה למסך הבית".
  const pic2 = `
    <svg viewBox="0 0 260 130" role="img" aria-label="השורה הוספה למסך הבית">
      <rect x="10" y="6" width="240" height="118" rx="16" fill="${paper}" stroke="${line}" stroke-width="2"/>
      <g font-family="Assistant, sans-serif" font-size="15" fill="${ink}" text-anchor="end">
        <text x="226" y="36">העתקה</text>
        <line x1="26" y1="50" x2="234" y2="50" stroke="${line}"/>
        <rect x="18" y="56" width="224" height="36" rx="10" fill="#f6e6c4" stroke="${gold}" stroke-width="3"/>
        <text x="226" y="80" font-weight="700">הוספה למסך הבית</text>
        <line x1="26" y1="98" x2="234" y2="98" stroke="${line}"/>
        <text x="226" y="117">הוספה לסימניות</text>
      </g>
      <g fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round">
        <rect x="32" y="63" width="22" height="22" rx="5"/><path d="M43 68v12M37 74h12"/>
      </g>
    </svg>`;

  // Step 3: the "הוספה" button at the top, next to the app icon.
  const pic3 = `
    <svg viewBox="0 0 260 120" role="img" aria-label="הכפתור הוספה בפינה">
      <rect x="10" y="10" width="240" height="100" rx="16" fill="${paper}" stroke="${line}" stroke-width="2"/>
      <g font-family="Assistant, sans-serif" font-size="15">
        <text x="232" y="40" text-anchor="end" fill="#8a7563">ביטול</text>
        <rect x="22" y="20" width="64" height="30" rx="15" fill="none" stroke="${gold}" stroke-width="3.5"/>
        <text x="54" y="41" text-anchor="middle" font-weight="700" fill="#1d6fd8">הוספה</text>
      </g>
      <rect x="186" y="62" width="40" height="40" rx="10" fill="#f3ead6" stroke="#d8ccb2"/>
      <rect x="192" y="70" width="26" height="7" rx="1.5" fill="#7a2430"/><rect x="195" y="77" width="27" height="8" rx="1.5" fill="#284a3c"/>
      <rect x="190" y="85" width="28" height="8" rx="1.5" fill="#2c3550"/><rect x="186" y="93" width="40" height="9" rx="2" fill="#a87a45"/>
      <text x="174" y="88" text-anchor="end" font-family="DM Serif Display, serif" font-size="17" fill="${ink}">By the Book</text>
    </svg>`;

  function showHelp() {
    const box = document.createElement("div");
    box.className = "install";
    box.innerHTML = `
      <div class="install-card" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <p class="brand">By the Book</p>
        <h2 id="install-title">${g("שימי", "שים", "שימו")} אותי במסך הבית</h2>
        <p class="install-intro">ככה אפתח במסך מלא, עם אייקון משלי, כמו אפליקציה רגילה.</p>
        <ol class="install-steps">
          <li>${pic1}<p>${g("לחצי", "לחץ", "לחצו")} על <b>כפתור השיתוף</b> בתחתית Safari.
             אם הוא לא מופיע, ${g("לחצי", "לחץ", "לחצו")} קודם על <b>⋯</b> ואז על <b>שיתוף</b>.</p></li>
          <li>${pic2}<p>${g("גללי", "גלול", "גללו")} למטה ו${g("בחרי", "בחר", "בחרו")} <b>הוספה למסך הבית</b>.</p></li>
          <li>${pic3}<p>${g("לחצי", "לחץ", "לחצו")} <b>הוספה</b> בפינה, וזהו!</p></li>
        </ol>
        <button class="stamp stamp-red install-ok" style="width:100%">הבנתי</button>
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add("show"));
    box.querySelector(".install-ok").addEventListener("click", () => {
      Store.state.seenInstallHelp = true;
      Store.save();
      box.classList.remove("show");
      setTimeout(() => box.remove(), 300);
    });
  }

  function maybeShowHelp() {
    if (isIOS && !isInstalled && !Store.state.seenInstallHelp) setTimeout(showHelp, 600);
  }

  return { maybeShowHelp, showHelp, isInstalled };
})();
