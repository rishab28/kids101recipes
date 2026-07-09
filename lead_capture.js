/**
 * Secret Swap Funnel - UTM Parameter Capturing & Forwarding to checkout links
 * Upgraded 2026 Version - Direct Redirection Mode (No opt-in popups)
 */

(function() {

  // Parse and cache UTMs from URL query parameters
  function parseAndCacheUtms() {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    utmKeys.forEach(key => {
      if (params.has(key)) {
        sessionStorage.setItem(key, params.get(key));
      }
    });
  }
  
  // Retrieve UTMs from cache
  function getCachedUtms() {
    const utms = {};
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    utmKeys.forEach(key => {
      const val = sessionStorage.getItem(key);
      if (val) utms[key] = val;
    });
    return utms;
  }

  // Appends UTMs + Prefill info + checkout=true to checkout URLs
  function appendUtmsToUrl(url) {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      
      // Always append checkout=true for Superprofile links
      if (url.includes("superprofile.bio")) {
        urlObj.searchParams.set('checkout', 'true');
      }

      const cachedUtms = getCachedUtms();
      
      // Append UTMs
      Object.keys(cachedUtms).forEach(key => {
        urlObj.searchParams.set(key, cachedUtms[key]);
      });
      
      return urlObj.toString();
    } catch (e) {
      return url; // fallback
    }
  }

  // Hook all Superprofile payment links immediately
  function hookCheckoutButtons() {
    // Cache UTM parameters immediately on script execution
    parseAndCacheUtms();
    
    // Select all CTA buttons: class btn, superprofile links, or pricing anchors
    const buttons = document.querySelectorAll('a.btn, a[href*="superprofile.bio"], a[href="#pricing"]');
    buttons.forEach(function(btn) {
      const href = btn.getAttribute('href') || "";
      
      // Append cached UTM values + checkout=true to all Superprofile payment links immediately
      if (href.includes("superprofile.bio")) {
        const newUrl = appendUtmsToUrl(href);
        btn.setAttribute('href', newUrl);
      }
    });
  }

  // Hook buttons on DOM load
  window.addEventListener('DOMContentLoaded', hookCheckoutButtons);
  setTimeout(hookCheckoutButtons, 1000);
  setTimeout(hookCheckoutButtons, 3000);

  // --- WEEKLY 5K LOTTERY ANNOUNCEMENT ---
  (function() {
    try {
      const params = new URLSearchParams(window.location.search);
      let ref = params.get('ref');
      
      // If not in URL, check cookies
      if (!ref) {
        const match = document.cookie.match(new RegExp('(^| )referral_code=([^;]+)'));
        if (match) ref = decodeURIComponent(match[2]);
      }

      document.addEventListener('DOMContentLoaded', function() {
        // 1. Dynamic Winner Generator
        const nameEl = document.getElementById('index-winner-promo');
        if (nameEl) {
          const today = new Date();
          const currentDay = today.getDay();
          const daysSinceSunday = currentDay === 0 ? 7 : currentDay;
          const lastSunday = new Date(today);
          lastSunday.setDate(today.getDate() - daysSinceSunday);
          
          const dateString = lastSunday.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          const seed = lastSunday.getFullYear() * 10000 + (lastSunday.getMonth() + 1) * 100 + lastSunday.getDate();
          
          const winners = [
            { name: "Karan Johar (Mumbai)", upi: "ka***ar" },
            { name: "Sunita Sharma (Delhi)", upi: "su****ma" },
            { name: "Rahul Verma (Bengaluru)", upi: "ra****ma" },
            { name: "Priya Patel (Ahmedabad)", upi: "pr****el" },
            { name: "Amit Singh (Lucknow)", upi: "am***gh" },
            { name: "Neha Gupta (Jaipur)", upi: "ne****ta" },
            { name: "Sanjay Reddy (Hyderabad)", upi: "sa****dy" }
          ];
          
          const winnerIndex = seed % winners.length;
          const winner = winners[winnerIndex];
          const prizes = ["AGARO Air Fryer", "NutriBullet Blender", "Japanese Bento Set", "₹5,000 Cash"];
          const chosenPrize = prizes[seed % prizes.length];
          nameEl.innerHTML = `Last Sunday's Winner: <strong>${winner.name} chose the ${chosenPrize}!</strong>`;
        }

        // 2. Setup Top Announcement Bar
        const topAlert = document.getElementById('topAlert');
        if (topAlert) {
          if (ref && ref.startsWith('KIT-')) {
            // Save/Refresh referral code in a 7-day cookie
            const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
            document.cookie = 'referral_code=' + encodeURIComponent(ref) +
              '; expires=' + expires + '; path=/; SameSite=Lax';

            topAlert.innerHTML = `🎁 REFERRAL DEAL: Invited by <strong>${ref}</strong>! Get the 'Smart Grocery Checklist' (Worth ₹399) FREE + Entry to Win Air Fryer / Blender / Bento Set / ₹5k Cash!`;
            topAlert.style.background = 'linear-gradient(90deg, #b45309, #d97706)';
            topAlert.style.color = '#fff';
            topAlert.style.fontWeight = '800';
          } else {
            // Default Lottery Announcement
            topAlert.innerHTML = `🍀 WEEKLY LUCKY DRAW: Win AGARO Air Fryer, NutriBullet, Japanese Bento, or ₹5,000 Cash! (Sunday Active)`;
            topAlert.style.background = 'linear-gradient(90deg, #064e3b, #047857)';
            topAlert.style.color = '#fff';
            topAlert.style.fontWeight = '700';
          }
        }
      });
    } catch(e) {}
  })();

  // --- DYNAMIC FOMO, SCARCITY & STICKY TIMER SUITE ---
  (function() {
    const styles = `
      .sticky-timer-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: linear-gradient(90deg, #2D241E 0%, #1A120E 100%);
        border-top: 2.5px solid var(--primary, #FF7020);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
        z-index: 99999;
        font-family: var(--font-body, system-ui);
        box-shadow: 0 -4px 25px rgba(0,0,0,0.45);
        transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
      }
      .sticky-timer-bar.hide {
        transform: translateY(100%);
      }
      .sticky-content {
        display: flex;
        align-items: center;
        gap: 15px;
        font-size: 0.92rem;
      }
      .sticky-highlight {
        color: #f59e0b;
        font-weight: 800;
      }
      .sticky-countdown-nums {
        font-family: monospace;
        font-weight: 900;
        background: rgba(0,0,0,0.55);
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.12);
        letter-spacing: 1px;
      }
      .sticky-btn {
        background: var(--primary, #FF7020);
        color: #fff;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        font-weight: 800;
        font-size: 0.9rem;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.2s ease-in-out;
        white-space: nowrap;
        animation: stickyPulse 2s infinite;
      }
      @keyframes stickyPulse {
        0% { box-shadow: 0 0 0 0 rgba(255,112,32,0.7); }
        70% { box-shadow: 0 0 0 10px rgba(255,112,32,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,112,32,0); }
      }
      .sticky-btn:hover {
        background: #e65f14;
        transform: scale(1.04);
      }
      
      .fomo-toast {
        position: fixed;
        bottom: 85px;
        left: 20px;
        background: #fff;
        color: #333;
        border-radius: 12px;
        padding: 12px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 99998;
        font-family: var(--font-body, system-ui);
        border: 1px solid rgba(0,0,0,0.06);
        max-width: 330px;
        transform: translateY(150px);
        opacity: 0;
        transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .fomo-toast.show {
        transform: translateY(0);
        opacity: 1;
      }
      .fomo-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 0.95rem;
        flex-shrink: 0;
      }
      .fomo-info {
        display: flex;
        flex-direction: column;
      }
      .fomo-text {
        font-size: 0.84rem;
        line-height: 1.35;
      }
      .fomo-time {
        font-size: 0.72rem;
        color: #777;
        margin-top: 2px;
      }
      
      @media (max-width: 768px) {
        .sticky-timer-bar {
          flex-direction: column;
          gap: 10px;
          padding: 10px 14px;
        }
        .sticky-content {
          font-size: 0.82rem;
          gap: 8px;
          text-align: center;
        }
        .sticky-btn {
          width: 100%;
          text-align: center;
          padding: 8px 12px;
        }
        .fomo-toast {
          bottom: 120px;
          left: 10px;
          right: 10px;
          max-width: none;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    document.head.appendChild(styleEl);

    document.addEventListener('DOMContentLoaded', function() {
      const isEnglish = window.location.pathname.includes('-en') || document.documentElement.lang === 'en';

      // ── REAL DAILY DEADLINE ENGINE ──────────────────────────────────────────
      function getRealDailyDeadline() {
        const now = new Date();
        const dateKey = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0');
        const storageKey = 'htf_deadline_' + dateKey;

        let deadline = parseInt(localStorage.getItem(storageKey) || '0', 10);
        if (!deadline || deadline <= now.getTime()) {
          const midnight = new Date(now);
          midnight.setHours(23, 59, 59, 999);
          deadline = midnight.getTime();
          localStorage.setItem(storageKey, deadline);
        }
        return deadline;
      }

      const DAILY_DEADLINE = getRealDailyDeadline();

      function getTimeLeft() {
        const now = Date.now();
        let diff = DAILY_DEADLINE - now;
        if (diff < 0) diff = 0;
        return {
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000)
        };
      }

      function updateMainCountdown() {
        const t = getTimeLeft();
        const dEl = document.getElementById('cdDays');
        const hEl = document.getElementById('cdHours');
        const mEl = document.getElementById('cdMin');
        const sEl = document.getElementById('cdSec');
        if (dEl) dEl.textContent = '00';
        if (hEl) hEl.textContent = String(t.h).padStart(2, '0');
        if (mEl) mEl.textContent = String(t.m).padStart(2, '0');
        if (sEl) sEl.textContent = String(t.s).padStart(2, '0');
      }
      updateMainCountdown();
      setInterval(updateMainCountdown, 1000);

      // ── 1. Sticky Bar Injection ─────────────────────────────────────────────
      const bar = document.createElement('div');
      bar.className = 'sticky-timer-bar hide';
      bar.id = 'stickyTimerBar';

      const dealText = isEnglish
        ? '🔥 TODAY ONLY: Price rises to <span class="sticky-highlight">₹1,299</span> — Offer expires at midnight in:'
        : '🔥 SIRF AAJ: Price <span class="sticky-highlight">₹1,299</span> ho jaayegi — Aaj raat midnight tak bacha hai:';

      const btnText = isEnglish ? 'Claim ₹499 Now →' : '₹499 Mein Abhi Lein →';

      // Always direct Superprofile link with checkout=true
      const stickyDest = appendUtmsToUrl("https://superprofile.bio/vp/kids-101-recipes");

      bar.innerHTML = `
        <div class="sticky-content">
          <span>${dealText}</span>
          <span class="sticky-countdown-nums" id="stickyClock">00:00:00</span>
        </div>
        <a href="${stickyDest}" class="sticky-btn">${btnText}</a>
      `;
      document.body.appendChild(bar);

      // 2. FOMO Popup Toast Injection
      const toast = document.createElement('div');
      toast.className = 'fomo-toast';
      toast.id = 'fomoToast';
      toast.innerHTML = `
        <div class="fomo-avatar" id="fomoAvatar">N</div>
        <div class="fomo-info">
          <div class="fomo-text" id="fomoText">...</div>
          <div class="fomo-time" id="fomoTime">1m ago</div>
        </div>
      `;
      document.body.appendChild(toast);

      // 3. Scroll Trigger to display sticky bar
      window.addEventListener('scroll', function() {
        const heroSection = document.getElementById('hero');
        const heroHeight = heroSection ? heroSection.offsetHeight : 500;
        if (window.scrollY > heroHeight) {
          bar.classList.remove('hide');
        } else {
          bar.classList.add('hide');
        }
      });

      // 4. Update Sticky Clock
      function updateStickyTimer() {
        const t = getTimeLeft();
        const clockEl = document.getElementById('stickyClock');
        if (clockEl) {
          clockEl.textContent =
            `${String(t.h).padStart(2,'0')}:${String(t.m).padStart(2,'0')}:${String(t.s).padStart(2,'0')}`;
        }
      }
      updateStickyTimer();
      setInterval(updateStickyTimer, 1000);

      // 5. FOMO Popup Rotator Loop
      const activities = isEnglish ? [
        { initial: "N", name: "Neha R. (Delhi)", action: "just purchased the Happy Tiffin Bundle!", time: "1 min ago" },
        { initial: "P", name: "Priya P. (Mumbai)", action: "unlocked the White Food Kid Survival Guide!", time: "3 mins ago" },
        { initial: "K", name: "Kiran V. (Pune)", action: "claimed entries for Sunday's Air Fryer draw!", time: "5 mins ago" },
        { initial: "S", name: "Sunita S. (Delhi)", action: "purchased the Happy Tiffin Bundle!", time: "7 mins ago" },
        { initial: "R", name: "Rahul S. (Bangalore)", action: "referred a friend and unlocked 5 bonus tickets!", time: "9 mins ago" }
      ] : [
        { initial: "N", name: "Neha R. (Delhi)", action: "ne Happy Tiffin Bundle kharida!", time: "1 min pehle" },
        { initial: "P", name: "Priya P. (Mumbai)", action: "ne White Food Kid Survival Guide unlock kiya!", time: "3 min pehle" },
        { initial: "K", name: "Kiran V. (Pune)", action: "ne Sunday Draw ke liye entry claim ki!", time: "5 min pehle" },
        { initial: "S", name: "Sunita S. (Delhi)", action: "ne Happy Tiffin Bundle order kiya!", time: "7 min pehle" },
        { initial: "R", name: "Rahul S. (Bangalore)", action: "ne friend ko share kar ke 5 tickets claims kiye!", time: "9 min pehle" }
      ];

      let fomoIndex = 0;
      function showFomoPopup() {
        const act = activities[fomoIndex];
        const avatarEl = document.getElementById('fomoAvatar');
        const textEl = document.getElementById('fomoText');
        const timeEl = document.getElementById('fomoTime');
        
        if (avatarEl && textEl && timeEl) {
          avatarEl.textContent = act.initial;
          avatarEl.style.background = ["#FF7020", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"][fomoIndex % 5];
          textEl.innerHTML = `<strong>${act.name}</strong> ${act.action}`;
          timeEl.textContent = act.time;
          
          toast.classList.add('show');
          
          setTimeout(function() {
            toast.classList.remove('show');
          }, 4500);
        }
        
        fomoIndex = (fomoIndex + 1) % activities.length;
      }

      setTimeout(function() {
        showFomoPopup();
        setInterval(showFomoPopup, 300000);
      }, 60000);
    });
  })();

})();
