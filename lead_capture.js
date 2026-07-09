/**
 * Secret Swap Funnel - Lead Capture, Exit Intent & Prefill Checkout System
 * Upgraded 2026 Version - Featuring:
 * - Real-Time Partial Lead Tracking (Debounced input sync)
 * - Session-Cached UTM Parameter Capturing & Forwarding to checkout links
 * - Gamified Scratch Card Exit-Intent Popup
 * - Meta Pixel Advanced Matching payload formatting
 */

(function() {
  // CONFIGURATION: Google Sheets webhook URL
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzCEwt12kadYtg6ZsNx9Dluo_NVpZdyRmfz85G9K9zZPCXmwucnRqXrRmu8jzBpEihnOw/exec";
  
  let leadModalInjected = false;
  let targetPaymentUrl = ""; // Stores checkout destination URL if clicked from a CTA
  let partialLeadSent = false;
  let typingTimer;
  const doneTypingInterval = 2500; // 2.5 seconds debounce for partial leads
  let isScratched = false;

  // Injected CSS Styles
  const style = document.createElement('style');
  style.innerHTML = `
    .lead-backdrop {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(8px);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      padding: 15px;
    }
    .lead-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }
    .lead-modal {
      background: #FFFFFF;
      width: 100%;
      max-width: 480px;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.25);
      overflow: hidden;
      transform: scale(0.9);
      transition: transform 0.3s ease;
      position: relative;
      border: 1px solid rgba(255, 112, 32, 0.1);
    }
    .lead-backdrop.active .lead-modal {
      transform: scale(1);
    }
    .lead-header {
      background: linear-gradient(135deg, #10B981, #059669);
      color: #FFFFFF;
      padding: 22px 20px;
      text-align: center;
      position: relative;
    }
    .lead-header.checkout-theme {
      background: linear-gradient(135deg, #FF7020, #FF5500);
    }
    .lead-header h3 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 800;
      font-family: 'Outfit', 'Inter', sans-serif;
      line-height: 1.3;
    }
    .lead-header p {
      margin: 6px 0 0;
      font-size: 0.88rem;
      opacity: 0.9;
    }
    .lead-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0,0,0,0.15);
      border: none;
      color: white;
      font-size: 1.2rem;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: background 0.2s;
    }
    .lead-close:hover {
      background: rgba(0,0,0,0.3);
    }
    .lead-body {
      padding: 22px;
    }
    .lead-form-group {
      margin-bottom: 14px;
      text-align: left;
    }
    .lead-form-group label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }
    .lead-input {
      width: 100%;
      padding: 10px 13px;
      border: 1.5px solid #CBD5E1;
      border-radius: 10px;
      font-size: 0.9rem;
      transition: border-color 0.2s;
      outline: none;
      color: #1E293B;
    }
    .lead-input:focus {
      border-color: #10B981;
    }
    .lead-header.checkout-theme ~ .lead-body .lead-input:focus {
      border-color: #FF7020;
    }
    .lead-submit-btn {
      width: 100%;
      background: #10B981;
      color: white;
      border: none;
      padding: 12px;
      font-size: 1rem;
      font-weight: 700;
      border-radius: 10px;
      cursor: pointer;
      box-shadow: 0 5px 15px rgba(16, 185, 129, 0.25);
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    .lead-submit-btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .lead-header.checkout-theme ~ .lead-body .lead-submit-btn {
      background: #FF7020;
      box-shadow: 0 5px 15px rgba(255, 112, 32, 0.25);
    }
    .lead-header.checkout-theme ~ .lead-body .lead-submit-btn:hover {
      background: #E05300;
    }
    .lead-trust {
      text-align: center;
      font-size: 0.7rem;
      color: #64748B;
      margin-top: 12px;
    }
    
    /* Scratch Card Animation Transition */
    #leadFormFields {
      transition: opacity 0.5s ease;
    }
  `;
  document.head.appendChild(style);

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

  // Appends UTMs + Prefill info to checkout URLs
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
      
      // Append Lead Prefill details if existing
      const savedLead = localStorage.getItem('funnel_lead');
      if (savedLead) {
        const lead = JSON.parse(savedLead);
        if (lead.name) urlObj.searchParams.set('name', lead.name);
        if (lead.email) urlObj.searchParams.set('email', lead.email);
        if (lead.phone) {
          urlObj.searchParams.set('phone', lead.phone);
          urlObj.searchParams.set('mobile', lead.phone);
        }
      }
      return urlObj.toString();
    } catch (e) {
      return url; // fallback
    }
  }

  // Send payload to Google Sheets webhook
  function sendWebhook(payload) {
    if (!WEBHOOK_URL || WEBHOOK_URL.includes("placeholder")) return;
    
    const formData = new URLSearchParams();
    Object.keys(payload).forEach(key => {
      formData.append(key, payload[key]);
    });

    fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData
    }).catch(err => console.log("Webhook fail:", err));
  }

  // Injects Modal Structure to DOM
  function injectModal() {
    if (leadModalInjected) return;
    
    const isKidsPage = true;
    
    let giftTitle = "🎁 WAIT! Get 3 Free Recipes + 1 Calendar + 50% OFF!";
    let giftSubtitle = "Fill this form to get 50% OFF (₹249 instead of ₹499) + your free gifts sent instantly!";
    let discountCode = isKidsPage ? "KIDS50" : "KHADU50";
    let paymentLink = isKidsPage ? "https://superprofile.bio/vp/kids-101-recipes?discountCode=KIDS50" : "https://superprofile.bio/vp/kids-101-recipes?discountCode=KHADU50";
    let gift1Name = isKidsPage ? "📥 Download 3 Free Recipes (PDF)" : "📥 Download 7 Herbal Drinks & Kadha Recipes (PDF)";
    let gift1Path = isKidsPage ? "deliverables/Five_Minute_Breakfast_Guide.pdf" : "final_deliverables_pdf_excel/Herbal_Drinks_Kadha_Recipes.pdf";
    let gift2Name = isKidsPage ? "📥 Download Empty Tiffin Calendar (Excel)" : "📥 Download Smart Grocery Lists (Excel)";
    let gift2Path = isKidsPage ? "deliverables/Empty_Tiffin_Calendar.xlsx" : "final_deliverables_pdf_excel/Smart_Grocery_Shopping_Lists.xlsx";
    
    const modalHtml = `
      <div class="lead-backdrop" id="leadBackdrop">
        <div class="lead-modal">
          <div class="lead-header" id="leadHeader">
            <button class="lead-close" id="leadCloseBtn">&times;</button>
            <h3 id="leadTitle">${giftTitle}</h3>
            <p id="leadSubtitle">${giftSubtitle}</p>
          </div>
          <div class="lead-body">
            
            <!-- GAMIFIED SCRATCH CARD AREA -->
            <div id="scratchCardArea" style="display: none; text-align: center; margin-bottom: 10px;">
              <p style="font-size: 0.9rem; font-weight: 700; color: var(--primary); margin-bottom: 6px;">🎉 Secret Deal Unlocked! Scratch to reveal your reward:</p>
              <div class="scratch-card-container">
                <div class="scratch-card-underlay">
                  <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: #E65100; font-weight: 700; display:block;">Your Prize</span>
                  <strong style="font-size: 1.2rem; color: #D84315; letter-spacing: 0.5px; display:block; margin: 2px 0;">50% OFF + ALL FREE BONUSES</strong>
                  <span style="font-size: 0.68rem; color: #5C524A;">Scratch 40%+ to unlock form</span>
                </div>
                <canvas id="scratchCanvas" class="scratch-card-canvas" width="280" height="140"></canvas>
              </div>
            </div>

            <!-- LEAD CAPTURE FORM -->
            <form id="leadForm">
              <div id="leadFormFields">
                <div class="lead-form-group">
                  <label>Your Name / Aapka Naam</label>
                  <input type="text" id="leadName" class="lead-input" placeholder="e.g. Neha Sharma" required />
                </div>
                <div class="lead-form-group">
                  <label>WhatsApp Number (10 digits)</label>
                  <input type="tel" id="leadPhone" class="lead-input" placeholder="e.g. 9876543210" pattern="[6-9][0-9]{9}" required />
                </div>
                <div class="lead-form-group">
                  <label>Email Address</label>
                  <input type="email" id="leadEmail" class="lead-input" placeholder="e.g. name@email.com" required />
                </div>
                
                <button type="submit" class="lead-submit-btn" id="leadSubmitBtn">
                  Claim My Gifts & 50% Discount →
                </button>
                <a href="#" id="leadSkipLink" style="display:none; text-align:center; font-size:0.75rem; color:#8F8379; margin-top:12px; text-decoration:underline; cursor:pointer;">Or proceed to secure payment directly without bonuses</a>
                
                <div class="lead-trust">
                  🔒 Protected by Indian DPDP Act 2023. We never share your details.
                </div>
              </div>
            </form>
            
            <!-- SUCCESS STATE / DOWNLOAD SCREEN (EXIT INTENT ONLY) -->
            <div id="leadSuccess" style="display: none; text-align: center;">
              <div style="font-size: 2.2rem; margin-bottom: 5px;">🎉</div>
              <h4 style="color: #10B981; font-size: 1.15rem; font-weight: 800; margin: 0 0 5px;">Gifts Unlocked & 50% OFF Applied!</h4>
              
              <!-- Discount Box -->
              <div style="background: #FFF3E0; border: 1.5px dashed #FF7020; border-radius: 12px; padding: 12px; margin-bottom: 15px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #E65100; font-weight: 700; display: block; margin-bottom: 3px;">Exclusive Coupon Unlocked</span>
                <strong style="font-size: 1.35rem; color: #D84315; letter-spacing: 1px; display: block; margin-bottom: 5px;" id="successDiscountCode">${discountCode}</strong>
                <p style="font-size: 0.82rem; color: #4E342E; margin: 0 0 10px; line-height: 1.4;">Claim the entire bundle at <b>50% OFF</b> (₹249 instead of ₹499) right now!</p>
                <a id="successPaymentLink" href="${paymentLink}" class="lead-submit-btn" style="background: #FF7020; box-shadow: 0 4px 12px rgba(255, 112, 32, 0.3); text-decoration: none; margin: 0 auto; width: 100%; max-width: 320px; font-size: 0.95rem;">Claim 50% Off & Buy Now →</a>
              </div>
              
              <!-- Downloads Box -->
              <div style="border-top: 1px solid #E2E8F0; padding-top: 12px; text-align: left;">
                <span style="font-size: 0.78rem; font-weight: 700; color: #475569; display: block; margin-bottom: 8px; text-align: center;">📥 Download Your Free Gifts:</span>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <a id="giftBtn1" href="${gift1Path}" class="lead-submit-btn" style="background: #10B981; text-decoration: none; margin: 0; font-size: 0.9rem; padding: 9px;" download>${gift1Name}</a>
                  <a id="giftBtn2" href="${gift2Path}" class="lead-submit-btn" style="background: #3B82F6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); text-decoration: none; margin: 0; font-size: 0.9rem; padding: 9px;" download>${gift2Name}</a>
                </div>
              </div>
              
              <button id="leadContinueBtn" class="lead-submit-btn" style="background: #64748B; box-shadow: none; font-size: 0.8rem; padding: 8px; margin-top: 15px; width: auto; display: inline-block;">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div);
    
    // Bind Events
    document.getElementById('leadCloseBtn').addEventListener('click', closeLeadModal);
    document.getElementById('leadContinueBtn').addEventListener('click', closeLeadModal);
    document.getElementById('leadBackdrop').addEventListener('click', function(e) {
      if (e.target === this) closeLeadModal();
    });
    document.getElementById('leadForm').addEventListener('submit', handleLeadSubmit);
    
    const skipLink = document.getElementById('leadSkipLink');
    if (skipLink) {
      skipLink.addEventListener('click', function(e) {
        e.preventDefault();
        closeLeadModal();
        localStorage.setItem('funnel_lead_skipped', 'true');
        if (typeof fbq === 'function') {
          fbq('trackCustom', 'SkipLeadCapture', {
            destinationUrl: targetPaymentUrl
          });
        }
        if (targetPaymentUrl) {
          try {
            const urlObj = new URL(targetPaymentUrl);
            urlObj.searchParams.set('checkout', 'true');
            const utmParams = getCachedUtms();
            Object.keys(utmParams).forEach(k => {
              if (utmParams[k]) {
                urlObj.searchParams.set(k, utmParams[k]);
              }
            });
            window.location.href = urlObj.toString();
          } catch(err) {
            window.location.href = targetPaymentUrl;
          }
        }
      });
    }
    
    leadModalInjected = true;
    setupPartialLeadListeners();
  }

  // Interactive Scratch Card Canvas Engine
  function initScratchCardEngine() {
    const canvas = document.getElementById('scratchCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    isScratched = false;

    // Grey Overlay cover
    ctx.fillStyle = '#C5BDB6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative scratch badge text
    ctx.fillStyle = '#5C524A';
    ctx.font = 'bold 13px var(--font-heading), sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👉 SCRATCH WITH FINGER OR MOUSE 👈', canvas.width / 2, canvas.height / 2 - 12);
    ctx.font = '10px var(--font-body), sans-serif';
    ctx.fillText('To Reveal Secret 50% Off Gift', canvas.width / 2, canvas.height / 2 + 12);

    function scratch(e) {
      if (!isDrawing || isScratched) return;
      const rect = canvas.getBoundingClientRect();
      // Handle Mouse or Touch client coordinates
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();

      checkScratchState();
    }

    function checkScratchState() {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let cleared = 0;
      for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i + 3] === 0) {
          cleared++;
        }
      }
      const pct = (cleared / (imgData.data.length / 4)) * 100;
      if (pct > 40 && !isScratched) {
        isScratched = true;
        
        // 2026 Funnel Superpower: Meta Pixel Custom Retargeting event
        if (typeof fbq === 'function') {
          fbq('trackCustom', 'ScratchCardRevealed', {
            coupon: 'KIDS50'
          });
        }
        localStorage.setItem('claimed_discount', 'true');

        canvas.style.transition = 'opacity 0.4s ease';
        canvas.style.opacity = '0';
        setTimeout(() => {
          canvas.style.display = 'none';
          document.getElementById('leadFormFields').style.opacity = '1';
          document.getElementById('leadFormFields').style.pointerEvents = 'auto';
        }, 400);
      }
    }

    canvas.addEventListener('mousedown', () => isDrawing = true);
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseleave', () => isDrawing = false);
    canvas.addEventListener('mousemove', scratch);

    canvas.addEventListener('touchstart', (e) => { isDrawing = true; e.preventDefault(); });
    canvas.addEventListener('touchend', () => isDrawing = false);
    canvas.addEventListener('touchmove', (e) => { scratch(e); e.preventDefault(); });
  }

  // Set up listeners for partial lead capture
  function setupPartialLeadListeners() {
    const fields = ['leadName', 'leadPhone', 'leadEmail'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          clearTimeout(typingTimer);
          typingTimer = setTimeout(capturePartialLead, doneTypingInterval);
        });
      }
    });
  }

  // Retrieve calculator details from localStorage to sync with Sheets webhook
  function getCalculatorData() {
    const savedCalc = localStorage.getItem('tiffin_calculator_data');
    if (savedCalc) {
      try {
        const parsed = JSON.parse(savedCalc);
        return {
          kid_age: parsed.age || "",
          tiffin_frequency: parsed.tiffin || "",
          rejected_foods: (parsed.rejectedFoods || []).join(", "),
          picky_score: parsed.score || ""
        };
      } catch (e) {
        console.warn("Failed to parse calculator data:", e);
      }
    }
    return {};
  }

  // Triggered when user pauses typing: captures name + valid phone/email
  function capturePartialLead() {
    if (partialLeadSent) return;

    const name = document.getElementById('leadName').value.trim();
    const phone = document.getElementById('leadPhone').value.trim();
    const email = document.getElementById('leadEmail').value.trim();

    // Standard phone check (10 digits) or valid looking email
    const isPhoneValid = /^[6-9]\d{9}$/.test(phone);
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (name.length >= 3 && (isPhoneValid || isEmailValid)) {
      partialLeadSent = true;
      const utmParams = getCachedUtms();
      const calcData = getCalculatorData();
      const payload = {
        name: name,
        phone: phone,
        email: email,
        url: window.location.href,
        status: "PARTIAL_LEAD",
        timestamp: new Date().toISOString(),
        ...utmParams,
        ...calcData
      };
      
      sendWebhook(payload);
    }
  }

  function openLeadModal(isCheckoutModal = false, destinationUrl = "") {
    injectModal();
    
    const backdrop = document.getElementById('leadBackdrop');
    const header = document.getElementById('leadHeader');
    const title = document.getElementById('leadTitle');
    const subtitle = document.getElementById('leadSubtitle');
    const submitBtn = document.getElementById('leadSubmitBtn');
    const scratchArea = document.getElementById('scratchCardArea');
    const formFields = document.getElementById('leadFormFields');
    
    const isKidsPage = true;
    targetPaymentUrl = isCheckoutModal ? destinationUrl : "";

    // Reset Success/Form states
    document.getElementById('leadForm').style.display = 'block';
    document.getElementById('leadSuccess').style.display = 'none';

    // Prefill form inputs if details exist in localStorage
    const savedLead = localStorage.getItem('funnel_lead');
    if (savedLead) {
      try {
        const lead = JSON.parse(savedLead);
        if (lead.name) document.getElementById('leadName').value = lead.name;
        if (lead.email) document.getElementById('leadEmail').value = lead.email;
        if (lead.phone) document.getElementById('leadPhone').value = lead.phone;
      } catch (err) {
        console.error(err);
      }
    }

    if (isCheckoutModal) {
      // Checkout Intercept Theme (Direct signup, no scratch card)
      header.classList.add('checkout-theme');
      title.innerHTML = "⚡ Complete Your Order";
      subtitle.innerHTML = "Enter details to proceed to secure payment gateway";
      submitBtn.innerHTML = "Proceed to Secure Payment →";
      scratchArea.style.display = 'none';
      formFields.style.opacity = '1';
      formFields.style.pointerEvents = 'auto';
      
      const skipLink = document.getElementById('leadSkipLink');
      if (skipLink) skipLink.style.display = 'block';
    } else {
      // Exit Intent Gift Theme (Scratch card unlocked)
      header.classList.remove('checkout-theme');
      submitBtn.innerHTML = "Claim My Gifts & 50% Discount →";
      
      scratchArea.style.display = 'block';
      formFields.style.opacity = '0.15';
      formFields.style.pointerEvents = 'none';
      
      const skipLink = document.getElementById('leadSkipLink');
      if (skipLink) skipLink.style.display = 'none';
      
      if (isKidsPage) {
        title.innerHTML = "🎁 WAIT! Get 3 Free Recipes + 1 Calendar + 50% OFF!";
        subtitle.innerHTML = "Fill this form to get 50% OFF (₹249 instead of ₹499) + your free gifts sent instantly!";
        document.getElementById('successDiscountCode').innerHTML = "KIDS50";
        document.getElementById('successPaymentLink').setAttribute('href', appendUtmsToUrl("https://superprofile.bio/vp/kids-101-recipes?discountCode=KIDS50"));
        document.getElementById('giftBtn1').innerHTML = "📥 Download 3 Free Recipes (PDF)";
        document.getElementById('giftBtn1').setAttribute('href', "deliverables/Five_Minute_Breakfast_Guide.pdf");
        document.getElementById('giftBtn2').innerHTML = "📥 Download Empty Tiffin Calendar (Excel)";
        document.getElementById('giftBtn2').setAttribute('href', "deliverables/Empty_Tiffin_Calendar.xlsx");
      } else {
        title.innerHTML = "🎁 WAIT! Get 7 Herbal Drinks & Kadha Recipes + 1 Grocery List + 50% OFF!";
        subtitle.innerHTML = "Fill this form to get 50% OFF (₹249 instead of ₹499) + your free gifts sent instantly!";
        document.getElementById('successDiscountCode').innerHTML = "KHADU50";
        document.getElementById('successPaymentLink').setAttribute('href', appendUtmsToUrl("https://superprofile.bio/vp/kids-101-recipes?discountCode=KHADU50"));
        document.getElementById('giftBtn1').innerHTML = "📥 Download 7 Herbal Drinks & Kadha Recipes (PDF)";
        document.getElementById('giftBtn1').setAttribute('href', "final_deliverables_pdf_excel/Herbal_Drinks_Kadha_Recipes.pdf");
        document.getElementById('giftBtn2').innerHTML = "📥 Download Smart Grocery Lists (Excel)";
        document.getElementById('giftBtn2').setAttribute('href', "final_deliverables_pdf_excel/Smart_Grocery_Shopping_Lists.xlsx");
      }

      // Hook success payment button to trigger Superprofile
      const successPayBtn = document.getElementById('successPaymentLink');
      if (successPayBtn) {
        successPayBtn.onclick = function(e) {
          e.preventDefault();
          const savedLead = localStorage.getItem('funnel_lead');
          if (savedLead) {
            const lead = JSON.parse(savedLead);
            closeLeadModal();
            localStorage.setItem('claimed_discount', 'true');
            redirectToSuperprofile(lead.name, lead.email, lead.phone, successPayBtn.getAttribute('href'));
          } else {
            document.getElementById('leadForm').style.display = 'block';
            document.getElementById('leadSuccess').style.display = 'none';
          }
        };
      }

      // Initialize the canvas draw loop
      setTimeout(initScratchCardEngine, 100);
    }
    
    backdrop.classList.add('active');
    
    // Facebook InitiateCheckout event removed to prevent duplicate firing with landing page CTA click
  }

  function closeLeadModal() {
    const backdrop = document.getElementById('leadBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
    }
  }

  function redirectToSuperprofile(name, email, phone, baseLink) {
    const link = baseLink || targetPaymentUrl || "https://superprofile.bio/vp/kids-101-recipes";
    try {
      const urlObj = new URL(link);
      
      // Append checkout=true
      urlObj.searchParams.set('checkout', 'true');
      
      // Append Lead info
      if (name) urlObj.searchParams.set('name', name);
      if (email) urlObj.searchParams.set('email', email);
      if (phone) {
        urlObj.searchParams.set('phone', phone);
        urlObj.searchParams.set('mobile', phone);
      }
      
      // Append UTMs
      const utmParams = getCachedUtms();
      Object.keys(utmParams).forEach(k => {
        if (utmParams[k]) {
          urlObj.searchParams.set(k, utmParams[k]);
        }
      });
      
      // Track InitiateCheckout
      if (typeof fbq === 'function') {
        const hasDiscount = localStorage.getItem('claimed_discount') === 'true';
        fbq('track', 'InitiateCheckout', {
          value: hasDiscount ? 249 : 499,
          currency: 'INR',
          content_name: 'Happy Tiffin Superprofile Checkout'
        });
      }
      
      window.location.href = urlObj.toString();
    } catch (e) {
      window.location.href = link;
    }
  }

  function handleLeadSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('leadName').value.trim();
    const phone = document.getElementById('leadPhone').value.trim();
    const email = document.getElementById('leadEmail').value.trim();
    
    const utmParams = getCachedUtms();
    const calcData = getCalculatorData();
    
    const payload = {
      name: name,
      phone: phone,
      email: email,
      url: window.location.href,
      status: "COMPLETED_LEAD",
      timestamp: new Date().toISOString(),
      ...utmParams,
      ...calcData
    };

    // Save lead locally as fallback & for auto-prefill logic
    localStorage.setItem('funnel_lead', JSON.stringify(payload));
    
    // Sync to webhook
    sendWebhook(payload);
    
    // Facebook Lead Event Tracking
    if (typeof fbq === 'function') {
      fbq('track', 'Lead', {
        content_name: targetPaymentUrl ? 'Checkout Opt-in Form' : 'Exit Intent Gift Form',
        value: 0.00,
        currency: 'INR'
      });
    }

    if (targetPaymentUrl) {
      // CHECKOUT CTA PATH: Proceed to Superprofile checkout
      closeLeadModal();
      redirectToSuperprofile(name, email, phone, targetPaymentUrl);
    } else {
      // EXIT INTENT PATH: Show success downloads page
      document.getElementById('leadForm').style.display = 'none';
      document.getElementById('leadSuccess').style.display = 'block';
    }
  }

  // --- EXIT INTENT TRIGGER LOGIC ---
  let exitIntentTriggered = false;
  
  function triggerExitIntent() {
    const isTestMode = window.location.search.includes('test=true');
    if (exitIntentTriggered && !isTestMode) return;
    if (localStorage.getItem('funnel_lead') && !isTestMode) return;
    
    exitIntentTriggered = true;
    openLeadModal(false); // Open exit-intent (scratch card enabled)
  }

  // 1. Desktop Exit Intent (Mouse leaves top of window)
  document.addEventListener('mouseleave', function(e) {
    if (e.clientY < 20) {
      triggerExitIntent();
    }
  });

  // 2. Mobile/Tablet Inactivity Timer (60 seconds)
  // Replaced back-button hijack to fully comply with Meta Ad Policies (Non-functional Landing Page / Circumventing Systems policies).
  let idleTime = 0;
  const idleInterval = setInterval(function() {
    idleTime += 1;
    if (idleTime >= 60) {
      triggerExitIntent();
      clearInterval(idleInterval);
    }
  }, 1000);

  const resetTimer = () => { idleTime = 0; };
  document.addEventListener('mousemove', resetTimer);
  document.addEventListener('keypress', resetTimer);
  document.addEventListener('touchstart', resetTimer);
  document.addEventListener('scroll', resetTimer);

  // --- HOOK CHECKOUT BUTTONS AND ANALYTICS ---
  function hookCheckoutButtons() {
    // Cache UTM parameters immediately on script execution
    parseAndCacheUtms();
    
    // Select all CTA buttons: class btn, superprofile links, or pricing anchors
    const buttons = document.querySelectorAll('a.btn, a[href*="superprofile.bio"], a[href="#pricing"]');
    buttons.forEach(function(btn) {
      const href = btn.getAttribute('href') || "";
      
      // Append cached UTM values to all Superprofile payment links immediately
      if (href.includes("superprofile.bio")) {
        const newUrl = appendUtmsToUrl(href);
        btn.setAttribute('href', newUrl);
      }

      // Capture landing page redirect clicks (excluding downsell pages)
      const isLandingPage = !window.location.href.includes("thankyou") && 
                            !window.location.href.includes("upsell") && 
                            !window.location.href.includes("downsell");
                            
      if (isLandingPage && !(btn.id || "").includes("downsellCTA")) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Determine the target checkout URL
          let targetUrl = btn.getAttribute('href');
          if (!targetUrl || targetUrl === "#pricing" || targetUrl.startsWith("#")) {
            targetUrl = "https://superprofile.bio/vp/kids-101-recipes";
          }
          openLeadModal(true, targetUrl); // Trigger modal capture
        });
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
            { name: "Amit Singh (Lucknow)", upi: "am****gh" },
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
      // Uses localStorage to persist a FIXED midnight deadline for each calendar day.
      // Key includes the date string so it auto-resets for a new day without code.
      // Returns the persisted deadline timestamp in ms.
      function getRealDailyDeadline() {
        const now = new Date();
        // Date key: YYYY-MM-DD in user's local timezone
        const dateKey = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0');
        const storageKey = 'htf_deadline_' + dateKey;

        let deadline = parseInt(localStorage.getItem(storageKey) || '0', 10);
        if (!deadline || deadline <= now.getTime()) {
          // Set midnight of today as the real deadline
          const midnight = new Date(now);
          midnight.setHours(23, 59, 59, 999);
          deadline = midnight.getTime();
          localStorage.setItem(storageKey, deadline);
        }
        return deadline;
      }

      const DAILY_DEADLINE = getRealDailyDeadline();

      // Shared timer tick function — returns {h, m, s} till deadline
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

      // Update main page countdown boxes (cdDays / cdHours / cdMin / cdSec)
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

      bar.innerHTML = `
        <div class="sticky-content">
          <span>${dealText}</span>
          <span class="sticky-countdown-nums" id="stickyClock">00:00:00</span>
        </div>
        <a href="#pricing" class="sticky-btn">${btnText}</a>
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

      // 4. Update Sticky Clock from real deadline
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
        setInterval(showFomoPopup, 300000); // Trigger subsequent popups every 5 minutes
      }, 60000); // Delay first popup to 1 minute after load
    });
  })();

})();
