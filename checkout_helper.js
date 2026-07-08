(function() {
  // Inject loader CSS styles
  const style = document.createElement('style');
  style.innerHTML = `
    .checkout-loader-backdrop {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      z-index: 200000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      color: #FFFFFF;
      font-family: 'Outfit', 'Inter', sans-serif;
    }
    .checkout-loader-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }
    .checkout-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255,255,255,0.1);
      border-top-color: #FF7020;
      border-radius: 50%;
      animation: checkout-spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes checkout-spin {
      to { transform: rotate(360deg); }
    }
    .checkout-loader-text {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(style);

  // Inject loader backdrop to body
  function injectCheckoutLoader() {
    if (document.getElementById('checkoutLoader')) return;
    const loader = document.createElement('div');
    loader.id = 'checkoutLoader';
    loader.className = 'checkout-loader-backdrop';
    loader.innerHTML = `
      <div class="checkout-spinner"></div>
      <div class="checkout-loader-text" id="checkoutLoaderText">Securing payment connection...</div>
    `;
    document.body.appendChild(loader);
  }

  function showCheckoutLoader(text) {
    injectCheckoutLoader();
    const loader = document.getElementById('checkoutLoader');
    const textEl = document.getElementById('checkoutLoaderText');
    if (textEl && text) textEl.textContent = text;
    if (loader) loader.classList.add('active');
  }

  function hideCheckoutLoader() {
    const loader = document.getElementById('checkoutLoader');
    if (loader) loader.classList.remove('active');
  }

  // Redirects to Superprofile URL appending lead & UTM params
  function redirectToSuperprofile(baseLink) {
    showCheckoutLoader("Redirecting to secure checkout...");
    
    // Retrieve prefill lead info
    const savedLead = localStorage.getItem('funnel_lead');
    let lead = null;
    if (savedLead) {
      try {
        lead = JSON.parse(savedLead);
      } catch (err) {
        console.error("Lead parse error:", err);
      }
    }

    // Helper to retrieve UTM params from cache
    function getCachedUtms() {
      const utms = {};
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
      utmKeys.forEach(key => {
        const val = sessionStorage.getItem(key);
        if (val) utms[key] = val;
      });
      return utms;
    }

    setTimeout(() => {
      try {
        const urlObj = new URL(baseLink);
        urlObj.searchParams.set('checkout', 'true');
        
        if (lead) {
          if (lead.name) urlObj.searchParams.set('name', lead.name);
          if (lead.email) urlObj.searchParams.set('email', lead.email);
          if (lead.phone) {
            urlObj.searchParams.set('phone', lead.phone);
            urlObj.searchParams.set('mobile', lead.phone);
          }
        }
        
        // Forward UTM parameters
        const utms = getCachedUtms();
        Object.keys(utms).forEach(k => {
          urlObj.searchParams.set(k, utms[k]);
        });

        window.location.href = urlObj.toString();
      } catch (e) {
        console.error("Redirect construction failed, falling back to raw link:", e);
        window.location.href = baseLink;
      }
    }, 450); // Small delay for visual feedback
  }

  // Expose to window
  window.redirectToSuperprofile = redirectToSuperprofile;
  window.showCheckoutLoader = showCheckoutLoader;
  window.hideCheckoutLoader = hideCheckoutLoader;
})();
