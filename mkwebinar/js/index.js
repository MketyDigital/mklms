const API_BASE = ''; // Set your custom API domain here if hosting the Cloudflare Worker on a different subdomain (e.g. 'https://api.starpipsforex.com')

// Globally intercept fetches to support external API Worker domain if configured
const originalFetch = window.fetch;
window.fetch = async function(resource, config) {
  if (typeof resource === 'string' && (resource.startsWith('api/') || resource.startsWith('/api/') || resource.startsWith('auth/') || resource.startsWith('/auth/'))) {
    const cleanPath = resource.startsWith('/') ? resource : '/' + resource;
    resource = API_BASE + cleanPath;
  }
  return originalFetch(resource, config);
};

window.HARDCODED_CAMPAIGN_FALLBACK = {
  "id": "starpips_transformation_v1",
  "title": "FREE LIVE CLASS: Learn exactly how I and my mentees earn thousands from forex and how you can make $1000 to $3000 monthly trading.",
  "presenterName": "Fx High Priest",
  "presenterTitle": "CEO, Starpips Forex",
  "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "countdownDuration": 15,
  "initialViewers": 1420,
  "peakViewers": 3840,
  "videoDuration": 3600,
  "zoomEnabled": false,
  "zoomMeetingId": "",
  "zoomPasscode": "",
  "zoomEmbedUrl": "",
  "zohoWebinarEnabled": false,
  "zohoWebinarUrl": "",
  "zoomRecordingUrl": "",
  "alumniModeEnabled": false,
  "landingImages": [
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
  ],
  "offer": {
    "title": "StarPips VIP Portfolio",
    "description": "Complete access to algorithmic suite",
    "price": "$200",
    "paymentLink": "https://paystack.shop/pay/starpips",
    "triggerTime": 45,
    "totalSlots": 12,
    "remainingSlots": 12
  },
  "chatScript": [],
  "specialOffers": []
};

let currentCampaign = null;
let currentLead = null;
let viewerCount = 1420;
let isVideoLive = false;
let videoStartTime = null;
let chatCursor = 0;
let isSpecialOffer = false;
let specialOfferCode = null;
let currentOfferData = null;
let hasSessionEnded = false;

// Initialization
window.onload = async () => {
  lucide.createIcons();
  
  const urlParams = new URLSearchParams(window.location.search);
  specialOfferCode = urlParams.get('special');
  
  await fetchCampaignConfig();
  
  // Floating CTA visibility
  const floatingBar = document.getElementById('floating-reg-bar');
  const mainAnchor = document.getElementById('main-registration-form-anchor');
  
  if (mainAnchor && floatingBar) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          floatingBar.classList.remove('translate-y-full', 'opacity-0');
        } else {
          floatingBar.classList.add('translate-y-full', 'opacity-0');
        }
      });
    }, { threshold: 0.1 });
    observer.observe(mainAnchor);
  }

  setInterval(simulatePurchases, 45000); // Random purchase popups
};

async function fetchCampaignConfig() {
  try {
    const response = await fetch('api/campaign');
    if (!response.ok) throw new Error("Server error");
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) throw new Error("Not JSON");
    currentCampaign = await response.json();
  } catch (err) {
    console.warn("Fallback to hardcoded config");
    currentCampaign = window.HARDCODED_CAMPAIGN_FALLBACK;
  }
  
  window.currentCampaign = currentCampaign;
  applyCampaignConfig();
  checkAndRestoreSession();
}

function applyCampaignConfig() {
  currentOfferData = currentCampaign.offer;

  // Always update main fields if they exist
  if (currentCampaign.title) {
    document.title = currentCampaign.title;
    const titleEl = document.getElementById('main-webinar-title');
    if (titleEl) titleEl.innerText = currentCampaign.title;
  }
  
  if (currentCampaign.presenterName) {
    const pName = document.getElementById('main-presenter-name');
    if (pName) pName.innerText = currentCampaign.presenterName;
    const regPName = document.getElementById('reg-presenter-name-display');
    if (regPName) regPName.innerText = currentCampaign.presenterName;
    const floatPName = document.getElementById('floating-presenter-name');
    if (floatPName) floatPName.innerText = currentCampaign.presenterName;
  }

  if (currentCampaign.presenterTitle) {
    const pTitle = document.getElementById('main-presenter-title');
    if (pTitle) pTitle.innerText = currentCampaign.presenterTitle;
  }

  if (specialOfferCode && currentCampaign.specialOffers) {
    const special = currentCampaign.specialOffers.find(o => o.code.toLowerCase() === specialOfferCode.toLowerCase());
    if (special) {
      const isExpired = special.expiresAt && Date.now() > new Date(special.expiresAt).getTime();
      if (!isExpired) {
        isSpecialOffer = true;
        if (special.webinarTitle) {
          const titleEl = document.getElementById('main-webinar-title');
          if (titleEl) titleEl.innerText = special.webinarTitle;
          document.title = special.webinarTitle;
        }
        if (special.presenterName) {
          const regPName = document.getElementById('reg-presenter-name-display');
          if (regPName) regPName.innerText = special.presenterName;
          const mainPName = document.getElementById('main-presenter-name');
          if (mainPName) mainPName.innerText = special.presenterName;
          const floatPName = document.getElementById('floating-presenter-name');
          if (floatPName) floatPName.innerText = special.presenterName;
        }
        if (special.presenterTitle) {
          const pTitle = document.getElementById('main-presenter-title');
          if (pTitle) pTitle.innerText = special.presenterTitle;
        }
        currentOfferData = {
          title: special.offerTitle || currentCampaign.offer.title,
          description: special.offerDescription || currentCampaign.offer.description,
          price: special.offerPrice || currentCampaign.offer.price,
          paymentLink: special.paymentLink || currentCampaign.offer.paymentLink,
          triggerTime: currentCampaign.offer.triggerTime,
          totalSlots: currentCampaign.offer.totalSlots,
          mode: currentCampaign.offer.mode || 'scheduled'
        };
      } else {
        showToast("This special pass has expired. Redirecting to standard webinar.", "error");
        window.history.replaceState({}, document.title, "/");
      }
    }
  }

  // Update dynamic content
  viewerCount = currentCampaign.initialViewers || 1420;
  document.getElementById('reg-active-viewer-placeholder').innerText = viewerCount.toLocaleString();
  
  if (currentCampaign.landingImages && currentCampaign.landingImages.length >= 4) {
    document.getElementById('landing-img-1').src = currentCampaign.landingImages[0];
    document.getElementById('landing-img-2').src = currentCampaign.landingImages[1];
    document.getElementById('landing-img-3').src = currentCampaign.landingImages[2];
    document.getElementById('landing-img-4').src = currentCampaign.landingImages[3];
  }
}

function scrollToMainForm() {
  document.getElementById('main-registration-form-anchor').scrollIntoView({ behavior: 'smooth' });
}

function showRegistrationFeedback(message, type = "error") {
  const feedbackEl = document.getElementById('registration-feedback');
  if (!feedbackEl) return;
  feedbackEl.innerText = message;
  feedbackEl.classList.remove('hidden');
  
  if (type === "error") {
    feedbackEl.className = "text-red-400 bg-red-950/40 border-red-500/30 text-center text-xs font-mono p-2.5 rounded-lg border mt-2 animate-pulse";
  } else if (type === "success") {
    feedbackEl.className = "text-emerald-400 bg-emerald-950/40 border-emerald-500/30 text-center text-xs font-mono p-2.5 rounded-lg border mt-2";
  } else {
    feedbackEl.className = "text-zinc-400 bg-zinc-900/40 border-zinc-800/30 text-center text-xs font-mono p-2.5 rounded-lg border mt-2";
  }
}

function showToast(message, type = "info") {
  const container = document.createElement('div');
  container.className = "fixed bottom-6 right-6 z-50 bg-[#04091A] border p-4 rounded-xl flex items-center space-x-3 shadow-2xl max-w-sm transition-all duration-500 transform translate-y-12 opacity-0 backdrop-blur-md";
  
  if (type === "error") {
    container.classList.add("border-red-500/20");
    container.innerHTML = `
      <div class="h-9 w-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
        <i data-lucide="alert-circle" class="h-5 w-5 stroke-[2.5]"></i>
      </div>
      <div class="flex-1">
        <span class="block text-xs font-bold text-white">System Notice</span>
        <span class="block text-[10px] text-zinc-400 font-mono leading-relaxed">${message}</span>
      </div>
    `;
  } else {
    container.classList.add("border-amber-500/20");
    container.innerHTML = `
      <div class="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
        <i data-lucide="info" class="h-5 w-5 stroke-[2.5]"></i>
      </div>
      <div class="flex-1">
        <span class="block text-xs font-bold text-white">System Notice</span>
        <span class="block text-[10px] text-zinc-400 font-mono leading-relaxed">${message}</span>
      </div>
    `;
  }
  
  document.body.appendChild(container);
  lucide.createIcons();
  
  // Fade in
  setTimeout(() => {
    container.classList.remove('translate-y-12', 'opacity-0');
  }, 100);
  
  // Fade out & remove
  setTimeout(() => {
    container.classList.add('translate-y-12', 'opacity-0');
    setTimeout(() => {
      container.remove();
    }, 500);
  }, 4000);
}

document.getElementById('form-registration').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const feedbackEl = document.getElementById('registration-feedback');
  if (feedbackEl) feedbackEl.classList.add('hidden');

  localStorage.removeItem('webinar_ended_state');

  const nameVal = document.getElementById('reg-name').value.trim();
  const emailVal = document.getElementById('reg-email').value.trim();
  const phoneVal = document.getElementById('reg-phone').value.trim();

  // Custom front-end Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailVal)) {
    showRegistrationFeedback("Please enter a valid email address (e.g., you@example.com) to secure your spot.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="animate-spin" data-lucide="loader"></i> <span>Securing Spot...</span>`;
  lucide.createIcons();

  const payload = {
    name: nameVal,
    email: emailVal,
    phone: phoneVal,
    status: 'watching'
  };

  try {
    const response = await fetch('api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok && data.success) {
      currentLead = { ...payload, id: data.token };
      localStorage.setItem('webinar_current_lead', JSON.stringify(currentLead));
      localStorage.setItem('webinar_registered_at', Date.now().toString());
      if (data.isReturning) {
        transitionToBroadcast();
      } else {
        transitionToWaitingRoom();
      }
    } else {
      showRegistrationFeedback("Registration failed: " + (data.error || "Please enter a valid, active email address."), "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Join Free Live Class</span><i data-lucide="arrow-right" class="h-4 w-4"></i>`;
      lucide.createIcons();
    }
  } catch (err) {
    console.warn("Server unavailable, using offline mode");
    currentLead = { ...payload, id: 'offline_user' };
    localStorage.setItem('webinar_current_lead', JSON.stringify(currentLead));
    localStorage.setItem('webinar_registered_at', Date.now().toString());
    transitionToWaitingRoom();
  }
});

function adjustVisualViewport() {
  const stageBroadcast = document.getElementById('stage-broadcast');
  if (stageBroadcast && !stageBroadcast.classList.contains('hidden')) {
    if (window.visualViewport) {
      const vv = window.visualViewport;
      stageBroadcast.style.height = `${vv.height}px`;
      stageBroadcast.style.top = `${vv.offsetTop}px`;
      stageBroadcast.style.bottom = 'auto';
      window.scrollTo(0, 0);
    }
  }
}

// Add global event listeners for the visual viewport
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', adjustVisualViewport);
  window.visualViewport.addEventListener('scroll', adjustVisualViewport);
}

// Also hook into focus/blur events to counter keyboard changes instantly
document.addEventListener('focusin', (e) => {
  if (e.target && (e.target.id === 'chat-input' || e.target.id === 'scholarship-phone')) {
    setTimeout(() => {
      window.scrollTo(0, 0);
      adjustVisualViewport();
    }, 50);
    setTimeout(() => {
      window.scrollTo(0, 0);
      adjustVisualViewport();
    }, 250);
  }
});

document.addEventListener('focusout', (e) => {
  if (e.target && (e.target.id === 'chat-input' || e.target.id === 'scholarship-phone')) {
    setTimeout(() => {
      window.scrollTo(0, 0);
      adjustVisualViewport();
    }, 50);
  }
});

function showStage(stageId) {
  window.scrollTo(0, 0);
  const stages = ['stage-registration', 'stage-waiting', 'stage-broadcast'];
  stages.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === stageId) {
        el.classList.remove('hidden');
        if (id === 'stage-broadcast' || id === 'stage-waiting') {
          el.classList.add('flex');
          if (id === 'stage-broadcast') {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            document.body.classList.remove('min-h-screen');
            document.body.classList.add('h-[100dvh]');
            window.scrollTo(0, 0);
            const footer = document.querySelector('footer');
            if (footer) footer.classList.add('hidden');
            
            // Apply visual viewport sizing immediately
            adjustVisualViewport();
          }
        }
      } else {
        el.classList.add('hidden');
        el.classList.remove('flex');
        if (id === 'stage-broadcast') {
          el.style.height = '';
          el.style.top = '';
          el.style.bottom = '';
        }
      }
    }
  });

  // Handle floating reg bar visibility
  const floatingBar = document.getElementById('floating-reg-bar');
  if (floatingBar) {
    if (stageId === 'stage-registration') {
      // IntersectionObserver handles this
    } else {
      floatingBar.classList.add('hidden');
    }
  }
}

function isWebpageUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('zoom.us')) return true;
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com') || lower.includes('zoho.com')) return true;
  
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.m3u8') || cleanUrl.endsWith('.mov')) {
    return false;
  }
  return url.startsWith('http');
}

function transitionToWaitingRoom(forcedWaitTime) {
  showStage('stage-waiting');

  let waitTime = (forcedWaitTime !== undefined) ? forcedWaitTime : (currentCampaign.countdownDuration || 15);
  const timerNode = document.getElementById('wait-timer-sec');
  
  // Update display immediately to prevent content jump
  const initialMins = Math.floor(waitTime / 60).toString().padStart(2, '0');
  const initialSecs = (waitTime % 60).toString().padStart(2, '0');
  timerNode.innerText = `${initialMins}:${initialSecs}`;
  
  const interval = setInterval(() => {
    waitTime--;
    const mins = Math.floor(waitTime / 60).toString().padStart(2, '0');
    const secs = (waitTime % 60).toString().padStart(2, '0');
    timerNode.innerText = `${mins}:${secs}`;
    
    if (waitTime <= 0) {
      clearInterval(interval);
      transitionToBroadcast();
    }
  }, 1000);
}

function transitionToBroadcast() {
  showStage('stage-broadcast');
  
  // Push "live" stage to Zoho if we have a currentLead
  if (window.currentLead) {
    fetch('/api/update-stage', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: window.currentLead.email,
        name: window.currentLead.name,
        phone: window.currentLead.phone,
        stage: 'live'
      })
    }).catch(e => console.error("Stage update error:", e));
  }
  
  // Set initial viewer count immediately to avoid static placeholder values
  const initEl1 = document.getElementById('chat-viewer-count');
  if (initEl1) initEl1.innerText = viewerCount.toLocaleString();
  const initEl2 = document.getElementById('dynamic-viewer-counter-video');
  if (initEl2) initEl2.innerText = viewerCount.toLocaleString();

  setupVideoPlayer();
  
  setInterval(() => {
    if (hasSessionEnded) return;
    viewerCount += Math.floor(Math.random() * 5) - 1;
    if (viewerCount > (currentCampaign.peakViewers || 3840)) viewerCount -= 10;
    
    const el1 = document.getElementById('chat-viewer-count');
    if (el1) el1.innerText = viewerCount.toLocaleString();
    const el2 = document.getElementById('dynamic-viewer-counter-video');
    if (el2) el2.innerText = viewerCount.toLocaleString();
  }, 4000);
}

function getZoomEmbedUrl(campaign, leadName, leadEmail) {
  let url = campaign.zoomEmbedUrl || "";
  let mId = campaign.zoomMeetingId || "";
  let pwd = campaign.zoomPasscode || "";

  // If the user pasted a full Zoom invite link in videoUrl or zoomRecordingUrl, check those too
  let videoUrl = campaign.videoUrl || "";
  let recUrl = campaign.zoomRecordingUrl || "";
  let sourceLink = url || (recUrl.includes('zoom.us') ? recUrl : "") || (videoUrl.includes('zoom.us') ? videoUrl : "");

  // Try to parse meeting ID and encrypted passcode from any zoom link
  if (sourceLink) {
    const idMatch = sourceLink.match(/\/j\/(\d+)/) || sourceLink.match(/\/s\/(\d+)/) || sourceLink.match(/\/wc\/join\/(\d+)/) || sourceLink.match(/\/wc\/(\d+)\/join/);
    if (idMatch && idMatch[1]) {
      mId = idMatch[1];
    }
    const pwdMatch = sourceLink.match(/[?&]pwd=([^&#]+)/);
    if (pwdMatch && pwdMatch[1]) {
      pwd = pwdMatch[1];
    }
  }

  // Normalize meeting ID by stripping out spaces or dashes
  if (mId) {
    mId = mId.toString().replace(/[\s-]/g, "");
  }

  // Determine host domain (zoom.us or web-client domain)
  let domain = "zoom.us";
  if (sourceLink) {
    const domainMatch = sourceLink.match(/https?:\/\/([^/]+)/);
    if (domainMatch && domainMatch[1]) {
      domain = domainMatch[1];
    }
  }

  const rawName = leadName || "VIP Attendee";
  const rawEmail = leadEmail || "vip-attendee@domain.com";
  let base64Name = "VklQIEF0dGVuZGVl"; // fallback base64 for "VIP Attendee"
  try {
    base64Name = btoa(unescape(encodeURIComponent(rawName)));
  } catch (e) {
    console.error("Base64 encoding failed, using fallback", e);
  }

  // If we have a meeting ID, construct the standard web client join link
  if (mId) {
    // Zoom Web Client supports passing name, email, and pwd (encrypted passcode hash)
    return `https://${domain}/wc/join/${mId}?prefer=1&un=${base64Name}&name=${encodeURIComponent(rawName)}&username=${encodeURIComponent(rawName)}&email=${encodeURIComponent(rawEmail)}&pwd=${pwd}&role=0`;
  }

  return url || videoUrl;
}

// NOTE: The entire video player implementation, including YouTube white-labeled API logic,
// un-clickable overlays, and buffering control layer, is isolated and managed in /public/js/player.js
// for clean optimization and ease of customization.

function startLiveTimeline() {
  if (isVideoLive) return;
  isVideoLive = true;
  
  // Align simulated video timeline to accurate elapsed webinar playtime since registration countdown passed
  const registeredAtStr = localStorage.getItem('webinar_registered_at');
  let startOffsetSec = 0;
  if (registeredAtStr) {
    const registeredAt = parseInt(registeredAtStr, 10);
    const countdownDurationSec = currentCampaign.countdownDuration || 15;
    const webinarStartMs = registeredAt + (countdownDurationSec * 1000);
    const elapsedMs = Date.now() - webinarStartMs;
    if (elapsedMs > 0) {
      startOffsetSec = Math.floor(elapsedMs / 1000);
    }
  }

  videoStartTime = Date.now() - (startOffsetSec * 1000);
  
  // Fast forward earlier messages sent in timeline prior to current offset
  const log = document.getElementById('webinar-chat-log');
  if (log) log.innerHTML = '';
  
  const scripts = currentCampaign.chatScript || [];
  chatCursor = 0;
  while (chatCursor < scripts.length && startOffsetSec >= scripts[chatCursor].timestamp) {
    chatCursor++;
  }
  // Only render the last 30 messages so we don't flood the UI
  const startIndex = Math.max(0, chatCursor - 30);
  for (let i = startIndex; i < chatCursor; i++) {
    appendChatBubble(scripts[i]);
  }
  
  // Restore user's local chats that they sent during the stream
  const localChats = JSON.parse(localStorage.getItem('webinar_my_chats') || '[]');
  localChats.forEach(chat => appendChatBubble(chat));
  
  // Instantly trigger offer call-out box if trigger timestamp already passed
  if (currentOfferData) {
    if (currentOfferData.mode === 'instant') {
      triggerOffer();
    } else if (currentOfferData.mode !== 'disabled' && startOffsetSec >= (currentOfferData.triggerTime || 45)) {
      triggerOffer();
    }
  }

  setInterval(tickTimeline, 1000);
}

function checkAndRestoreSession() {
  const storedLead = localStorage.getItem('webinar_current_lead');
  const registeredAtStr = localStorage.getItem('webinar_registered_at');
  
  if (storedLead && registeredAtStr) {
    try {
      currentLead = JSON.parse(storedLead);
      const registeredAt = parseInt(registeredAtStr, 10);
      const countdownDurationSec = currentCampaign.countdownDuration || 15;
      const elapsedMs = Date.now() - registeredAt;
      const hoursElapsed = elapsedMs / (1000 * 60 * 60);

      // Reset the session if it's older than 48 hours to force re-registration
      if (hoursElapsed >= 48) {
        console.log("Session older than 48 hours, clearing local state to allow re-registration.");
        localStorage.removeItem('webinar_current_lead');
        localStorage.removeItem('webinar_registered_at');
        currentLead = null;
        return;
      }

      const countdownMs = countdownDurationSec * 1000;
      
      console.log("Restoring active registrant session:", currentLead.name, `elapsed: ${Math.floor(elapsedMs/1000)}s`);
      
      /* 
       ================================================================================
       ADJUSTMENT POINT: RESTORE SESSION AUTO-COMPLETE LIMITS
       We have removed the hardcoded clock duration auto-completion trigger to ensure 
       the video stays open and never terminates mid-stream for active registrants.
       ================================================================================
      */

      if (elapsedMs < countdownMs) {
        // Still in waiting countdown phase
        const remainingSec = Math.ceil((countdownMs - elapsedMs) / 1000);
        transitionToWaitingRoom(remainingSec);
      } else {
        // Directly to stream room
        transitionToBroadcast();
      }
    } catch (e) {
      console.error("Error restoring session state:", e);
    }
  }
}

function tickTimeline() {
  if (!isVideoLive) return;
  
  let currentElapsedSec = 0;
  
  // Calculate live clock based on true registration time!
  const registeredAtStr = localStorage.getItem('webinar_registered_at');
  if (registeredAtStr) {
     const registeredAt = parseInt(registeredAtStr, 10);
     const cDur = currentCampaign.countdownDuration || 15;
     const eMs = Date.now() - (registeredAt + (cDur * 1000));
     if (eMs > 0) currentElapsedSec = Math.floor(eMs / 1000);
  } else {
     // Fallback if somehow not registered
     currentElapsedSec = Math.floor((Date.now() - videoStartTime) / 1000);
  }

  // Handle seeking: if playhead is less than the previous message or significantly ahead of our current cursor, reset and rebuild
  const scripts = currentCampaign.chatScript || [];
  let shouldResetCursor = false;
  
  if (chatCursor > 0 && chatCursor <= scripts.length) {
    const prevMsgTimestamp = scripts[chatCursor - 1].timestamp;
    if (currentElapsedSec < prevMsgTimestamp || currentElapsedSec > prevMsgTimestamp + 15) {
      shouldResetCursor = true;
    }
  } else if (chatCursor === 0 && scripts.length > 0 && currentElapsedSec > scripts[0].timestamp + 15) {
    shouldResetCursor = true;
  }

  if (shouldResetCursor) {
    console.log("[Chat Sync] Seeking playhead detected, rebuilding active chat log to second:", currentElapsedSec);
    const log = document.getElementById('webinar-chat-log');
    if (log) log.innerHTML = '';
    
    chatCursor = 0;
    while (chatCursor < scripts.length && currentElapsedSec >= scripts[chatCursor].timestamp) {
      chatCursor++;
    }
    const startIndex = Math.max(0, chatCursor - 30);
    for (let i = startIndex; i < chatCursor; i++) {
      appendChatBubble(scripts[i]);
    }

    // Restore user's local chats that they sent during the stream so they don't disappear on rebuild
    const localChats = JSON.parse(localStorage.getItem('webinar_my_chats') || '[]');
    localChats.forEach(chat => appendChatBubble(chat));
    window._localChatsRestored = true;
  } else {
    // Normal sequential progression
    while (chatCursor < scripts.length && currentElapsedSec >= scripts[chatCursor].timestamp) {
      appendChatBubble(scripts[chatCursor]);
      chatCursor++;
    }
    if (!window._localChatsRestored) {
      window._localChatsRestored = true;
      const localChats = JSON.parse(localStorage.getItem('webinar_my_chats') || '[]');
      localChats.forEach(chat => appendChatBubble(chat));
    }
  }

  // Check for offer trigger
  if (currentOfferData) {
    if (currentOfferData.mode === 'instant') {
      triggerOffer();
    } else if (currentOfferData.mode !== 'disabled' && currentElapsedSec >= (currentOfferData.triggerTime || 45)) {
      triggerOffer();
    }
  }
}

function triggerOffer() {
  const offerContainer = document.getElementById('webinar-offer-container');
  
  // Push "offer" stage to Zoho if we have a currentLead
  if (window.currentLead && offerContainer && offerContainer.classList.contains('hidden')) {
    fetch('/api/update-stage', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: window.currentLead.email,
        name: window.currentLead.name,
        phone: window.currentLead.phone,
        stage: 'offer'
      })
    }).catch(e => console.error("Stage update error:", e));
  }

  if (!offerContainer.classList.contains('hidden')) return;
  
  document.getElementById('offer-title').innerText = currentOfferData.title;
  document.getElementById('offer-desc').innerText = currentOfferData.description;
  document.getElementById('offer-price').innerText = currentOfferData.price;
  
  const btn = document.getElementById('offer-selar-link');
  let url = currentOfferData.paymentLink;
  if (currentLead && currentLead.email) {
    url += (url.includes('?') ? '&' : '?') + 'email=' + encodeURIComponent(currentLead.email);
  }
  btn.href = url;
  
  document.getElementById('scarcity-counter').innerText = currentOfferData.totalSlots || 12;
  
  offerContainer.classList.remove('hidden');
  setTimeout(() => {
    offerContainer.classList.remove('scale-95', 'opacity-0');
    offerContainer.classList.add('scale-100', 'opacity-100');
  }, 100);

  appendChatBubble({
    senderName: "SYSTEM MODERATOR",
    message: "🔥 VIP ENROLLMENT IS NOW OPEN! Click the link below the video to secure your spot."
  }, true);
}

function appendChatBubble(msg, isSystem = false) {
  const log = document.getElementById('webinar-chat-log');
  const node = document.createElement('div');
  node.className = "text-xs space-y-0.5 animate-fade-in";
  
  if (isSystem) {
    node.innerHTML = `
      <div class="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-amber-500 font-bold font-mono">
        <i data-lucide="bell" class="h-3.5 w-3.5 inline mr-1"></i> ${msg.message}
      </div>
    `;
  } else {
    node.innerHTML = `
      <span class="font-black text-[#006fff] uppercase">${msg.senderName}:</span>
      <span class="text-zinc-300 font-sans ml-1">${msg.message}</span>
    `;
  }
  
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
  if (isSystem) lucide.createIcons();
}

document.getElementById('form-live-chat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const val = input.value.trim();
  if (!val) return;
  
  input.value = '';
  
  appendChatBubble({
    senderName: currentLead ? currentLead.name : "You",
    message: val
  });
  
  // Store locally to survive refresh
  const localChats = JSON.parse(localStorage.getItem('webinar_my_chats') || '[]');
  localChats.push({
    senderName: currentLead ? currentLead.name : "You",
    message: val,
    timestamp: Date.now()
  });
  localStorage.setItem('webinar_my_chats', JSON.stringify(localChats));

  const curTime = (currentCampaign.zoomEnabled || currentCampaign.zohoWebinarEnabled)
    ? Math.floor((Date.now() - videoStartTime) / 1000) 
    : document.getElementById('main-video-player').currentTime;

  try {
    await fetch('api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: currentLead ? currentLead.id : null,
        message: val,
        videoTime: curTime,
        name: currentLead ? currentLead.name : "Unknown",
        email: currentLead ? currentLead.email : "Unknown"
      })
    });
  } catch (err) {
    console.warn("Could not sync comment to CRM server");
  }
});

function handleVideoEnd() {
  hasSessionEnded = true;
  localStorage.setItem('webinar_ended_state', 'true');

  // 1. Keep giant overlay hidden as requested (instead, only offline and participants badges show on player)
  const endedOverlay = document.getElementById('video-ended-overlay');
  if (endedOverlay) {
    endedOverlay.classList.add('hidden');
    endedOverlay.classList.remove('flex');
    endedOverlay.classList.remove('opacity-100');
    endedOverlay.classList.add('opacity-0');
  }

  const clickOverlay = document.getElementById('video-click-overlay');
  if (clickOverlay) {
    clickOverlay.classList.add('hidden');
  }

  // 2. Set dynamic email query on the replay CTA button
  const replayBtn = document.getElementById('video-ended-replay-btn');
  if (replayBtn) {
    const emailParam = currentLead && currentLead.email ? `?email=${encodeURIComponent(currentLead.email)}` : '';
    replayBtn.href = `/replay${emailParam}`;
  }

  // 3. Update top left badge to OFFLINE
  const liveBadge = document.getElementById('video-top-live-badge');
  if (liveBadge) {
    liveBadge.className = "flex items-center gap-1.5 bg-zinc-700/90 px-2 py-1 rounded shadow-lg";
    liveBadge.innerHTML = `
      <span class="relative flex h-1.5 w-1.5">
        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-400"></span>
      </span>
      <span class="text-[9px] font-black text-white tracking-widest uppercase">OFFLINE</span>
    `;
  }

  // 4. Update views badge to peak viewers + LAST SESSION PARTICIPANTS
  const viewsBadge = document.getElementById('video-top-views-badge');
  const peakVal = currentCampaign && currentCampaign.peakViewers ? currentCampaign.peakViewers : 3840;
  if (viewsBadge) {
    viewsBadge.className = "flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded shadow-lg border border-white/10";
    viewsBadge.innerHTML = `
      <i data-lucide="users" class="h-3 w-3 text-zinc-400"></i>
      <span class="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest"><strong class="text-white">${peakVal.toLocaleString()}</strong> LAST SESSION PARTICIPANTS</span>
    `;
  }

  // Re-create icons if Lucide is available
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  // 5. Trigger existing checkout offer box to make sure it's on the screen
  if (typeof triggerOffer === 'function') {
    triggerOffer();
  }

  // 6. Trigger existing scholarship form fade-in
  const scholarshipContainer = document.getElementById('scholarship-form-container');
  if (scholarshipContainer) {
    scholarshipContainer.classList.remove('hidden');
    setTimeout(() => {
      scholarshipContainer.classList.remove('scale-95', 'opacity-0');
      scholarshipContainer.classList.add('scale-100', 'opacity-100');
    }, 100);
  }
}
window.handleVideoEnd = handleVideoEnd;

document.getElementById('form-scholarship').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('scholarship-phone').value;
  
  try {
    await fetch(`api/phone-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name: currentLead?.name, email: currentLead?.email })
    });
    document.getElementById('scholarship-form-container').innerHTML = `
      <div class="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-6 text-center text-emerald-400 font-bold text-base shadow-[0_0_20px_rgba(16,185,129,0.15)]">
        <p class="text-xl mb-1">🎉 Application Received!</p>
        <p class="text-xs font-medium text-emerald-500/80 uppercase tracking-wider">The mentorship team will call you shortly.</p>
      </div>
    `;
  } catch (err) {
    document.getElementById('scholarship-form-container').innerHTML += `
      <p class="text-red-500 text-xs text-center mt-2 font-bold">Failed to submit request. Please try again.</p>
    `;
  }
});

function simulatePurchases() {
  if (!isVideoLive || document.getElementById('webinar-offer-container').classList.contains('hidden')) return;
  
  const names = ["James O.", "Sarah M.", "David K.", "Michael B.", "Elena R.", "John T.", "Fatima S."];
  const buyer = names[Math.floor(Math.random() * names.length)];
  
  const scarcityNode = document.getElementById('scarcity-counter');
  let currentSlots = parseInt(scarcityNode.innerText, 10);
  if (currentSlots > 1) {
    currentSlots--;
    scarcityNode.innerText = currentSlots;
  }
  
  const toast = document.getElementById('purchase-toast-alert');
  document.getElementById('toast-buyer-name').innerText = buyer;
  toast.classList.remove('translate-y-12', 'opacity-0');
  
  setTimeout(() => {
    toast.classList.add('translate-y-12', 'opacity-0');
  }, 5000);
}


// Internal tracking ping
function pingTracker(eventName) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventName })
    }).catch(e => {});
  } catch(err) {}
}

// Ping pageview on load
document.addEventListener('DOMContentLoaded', () => {
  pingTracker('pageview');
});
