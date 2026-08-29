const API_BASE = ''; // Set your custom API domain here if hosting the Cloudflare Worker on a different subdomain (e.g. 'https://api.starpipsforex.com')

const originalFetch = window.fetch;
window.fetch = async function(...args) {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.startsWith('/api/')) {
    resource = API_BASE + resource;
    config = config || {};
    config.headers = config.headers || {};
    const pass = localStorage.getItem('adminPass');
    if (pass) {
      config.headers['X-Admin-Password'] = pass;
    }
  }
  let response = await originalFetch(resource, config);
  if (response.status === 401) {
    const newPass = prompt("Admin authentication required. Please enter the admin password (e.g. StarPips2026!):");
    if (newPass) {
      localStorage.setItem('adminPass', newPass);
      config.headers['X-Admin-Password'] = newPass;
      response = await originalFetch(resource, config);
    }
  }
  return response;
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
    "title": "StarPips Forex Transformation VIP Portfolio",
    "description": "Get complete access to the proprietary StarPips Algorithmic Sweep indicator, 1-on-1 weekly live mentorship sessions with Fx High Priest, and our Institutional Risk Management spreadsheet suite.",
    "price": "$297 (Single Enrollment Licensing)",
    "paymentLink": "https://paystack.shop/pay/starpips",
    "triggerTime": 45,
    "totalSlots": 12,
    "remainingSlots": 12
  },
  "chatScript": [],
  "zohoConfig": {},
  "specialOffers": []
};

let campaign = null;
let registrants = [];
let comments = [];

async function loadCampaignSettings() {

  // Load internal traffic stats
  try {
    const statRes = await fetch('/api/stats', {});
    if (statRes.ok) {
      const stats = await statRes.json();
      const viewsEl = document.getElementById('stat-views');
      if (viewsEl) {
        viewsEl.textContent = stats.views || 0;
        document.getElementById('stat-clicks').textContent = stats.clicks || 0;
        const conv = stats.views > 0 ? ((stats.clicks || 0) / stats.views * 100).toFixed(1) : 0;
        document.getElementById('stat-conv').textContent = conv + '%';
      }
    }
  } catch(e) {}

  try {
    const response = await fetch('/api/campaign');
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType || !contentType.includes("application/json")) {
      throw new Error("Server not responding with JSON");
    }
    campaign = await response.json();
  } catch (err) {
    console.warn("Failed to load settings from server, using hardcoded fallback. Error:", err);
    campaign = window.HARDCODED_CAMPAIGN_FALLBACK;
  }
    
  try {
    if (campaign) {
      document.getElementById('sett-title').value = campaign.title || '';
      document.getElementById('sett-presenter-name').value = campaign.presenterName || '';
      document.getElementById('sett-presenter-title').value = campaign.presenterTitle || '';
      document.getElementById('sett-video-url').value = campaign.videoUrl || '';
      if(document.getElementById('sett-replay-video-url')) document.getElementById('sett-replay-video-url').value = campaign.replayVideoUrl || '';
      if(document.getElementById('sett-replay-expiry')) document.getElementById('sett-replay-expiry').value = campaign.replayExpiryHours || '';
      document.getElementById('sett-is-real-youtube-live').checked = campaign.isRealYoutubeLive || false;
      document.getElementById('sett-wait-duration').value = campaign.countdownDuration !== undefined ? campaign.countdownDuration : 15;
      document.getElementById('sett-initial-viewers').value = campaign.initialViewers !== undefined ? campaign.initialViewers : 1420;
      document.getElementById('sett-peak-viewers').value = campaign.peakViewers !== undefined ? campaign.peakViewers : 3840;
      
      if (document.getElementById('sett-zoom-enabled')) document.getElementById('sett-zoom-enabled').checked = campaign.zoomEnabled || false;
      if (document.getElementById('sett-zoom-meeting-id')) document.getElementById('sett-zoom-meeting-id').value = campaign.zoomMeetingId || '';
      if (document.getElementById('sett-zoom-passcode')) document.getElementById('sett-zoom-passcode').value = campaign.zoomPasscode || '';
      if (document.getElementById('sett-zoom-embed-url')) document.getElementById('sett-zoom-embed-url').value = campaign.zoomEmbedUrl || '';
      
      const zoomLiveModeEl = document.getElementById('sett-zoom-live-mode');
      if (zoomLiveModeEl) zoomLiveModeEl.value = campaign.zoomLiveMode || 'recording-live';
      const zoomSdkKeyEl = document.getElementById('sett-zoom-sdk-key');
      if (zoomSdkKeyEl) zoomSdkKeyEl.value = campaign.zoomSdkKey || '';
      const zoomSdkSecretEl = document.getElementById('sett-zoom-sdk-secret');
      if (zoomSdkSecretEl) zoomSdkSecretEl.value = campaign.zoomSdkSecret || '';

      const zohoWebinarEnabledEl = document.getElementById('sett-zoho-webinar-enabled');
      if (zohoWebinarEnabledEl) zohoWebinarEnabledEl.checked = campaign.zohoWebinarEnabled || false;
      const zohoWebinarUrlEl = document.getElementById('sett-zoho-webinar-url');
      if (zohoWebinarUrlEl) zohoWebinarUrlEl.value = campaign.zohoWebinarUrl || '';
      
      if (document.getElementById('sett-alumni-enabled')) document.getElementById('sett-alumni-enabled').checked = campaign.alumniModeEnabled !== false;
      if (document.getElementById('sett-unique-visits-only')) document.getElementById('sett-unique-visits-only').checked = campaign.uniqueVisitsOnly || false;
      if (document.getElementById('sett-zoom-recording-url')) document.getElementById('sett-zoom-recording-url').value = campaign.zoomRecordingUrl || '';
      
      const offer = campaign.offer || {};
      document.getElementById('sett-offer-title').value = offer.title || '';
      document.getElementById('sett-offer-price').value = offer.price || '';
      document.getElementById('sett-offer-desc').value = offer.description || '';
      document.getElementById('sett-offer-payment').value = offer.paymentLink || '';
      document.getElementById('sett-offer-trigger').value = offer.triggerTime !== undefined ? offer.triggerTime : 45;
      document.getElementById('sett-offer-slots').value = offer.totalSlots !== undefined ? offer.totalSlots : 12;
      
      const tracking = campaign.tracking || {};
      if(document.getElementById('track-fb')) document.getElementById('track-fb').value = tracking.fbPixel || '';
      if(document.getElementById('track-tk')) document.getElementById('track-tk').value = tracking.tiktokPixel || '';
      if(document.getElementById('track-ga')) document.getElementById('track-ga').value = tracking.gaPixel || '';
  
      if (document.getElementById('sett-offer-mode')) document.getElementById('sett-offer-mode').value = offer.mode || 'scheduled';

      if (campaign.landingImages && campaign.landingImages.length >= 4) {
        document.getElementById('sett-img-1').value = campaign.landingImages[0] || '';
        document.getElementById('sett-img-2').value = campaign.landingImages[1] || '';
        document.getElementById('sett-img-3').value = campaign.landingImages[2] || '';
        document.getElementById('sett-img-4').value = campaign.landingImages[3] || '';
      }

       const zoho = campaign.zohoConfig || {};
      document.getElementById('sett-zoho-client-id').value = zoho.clientId || '';
      document.getElementById('sett-zoho-client-secret').value = zoho.clientSecret || '';
      document.getElementById('sett-zoho-refresh-token').value = zoho.refreshToken || '';
      document.getElementById('sett-zoho-list-id').value = zoho.listId || '';
      document.getElementById('sett-zoho-welcome-template').value = zoho.welcomeTemplateId || '';
      document.getElementById('sett-zoho-reminder-template').value = zoho.reminderTemplateId || '';
      document.getElementById('sett-zoho-followup-template').value = zoho.followupTemplateId || '';
      document.getElementById('sett-zoho-followup2-template').value = zoho.followup2TemplateId || '';
      document.getElementById('sett-zoho-payment-template').value = zoho.paymentTemplateId || '';

      
      // Removed SMTP bindings


      
      // DYNAMIC TEMPLATES INJECTION
      


      renderSpecialLinks(campaign.specialOffers || []);
      renderChatScriptLogs(campaign.chatScript || []);
    }
  } catch (err) {
    console.error("Error populating admin form settings fields:", err);
  }
}

function renderChatScriptLogs(scriptList) {
  const parent = document.getElementById('admin-chat-preview');
  parent.innerHTML = '';
  
  if (scriptList.length === 0) {
    parent.innerHTML = `<span class="block text-zinc-600 italic">No scheduled comments in active script. Generate above or seed campaign.json.</span>`;
    return;
  }

  const sorted = [...scriptList].sort((a,b) => a.timestamp - b.timestamp);

  sorted.forEach(msg => {
    const node = document.createElement('div');
    node.className = "flex justify-between items-center bg-zinc-900/60 border border-zinc-900 p-2.5 rounded-lg";
    node.innerHTML = `
      <div>
        <span class="text-amber-500 font-bold font-mono">[${msg.timestamp}s]</span>
        <strong class="text-zinc-200 ml-1 font-mono">${msg.senderName}:</strong>
        <span class="text-zinc-400 font-sans ml-1">${msg.message}</span>
      </div>
      <button onclick="deleteChatMessage('${msg.id}')" class="text-zinc-600 hover:text-red-500 transition ml-2">
        <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
      </button>
    `;
    parent.appendChild(node);
  });

  lucide.createIcons();
}

window.deleteChatMessage = async function(id) {
  if (!confirm("Delete scheduled message from live script?")) return;
  try {
    const response = await fetch(`/api/campaign/chat/${id}`, { method: 'DELETE' });
    const data = await response.json();
    campaign.chatScript = data.chatScript;
    renderChatScriptLogs(campaign.chatScript);
  } catch (err) {
    alert("Failed to delete message");
  }
}

window.copyWebhookUrl = function(type) {
  let urlText = '';
  if (type === 'paystack') {
    urlText = document.getElementById('paystack-webhook-url-display').innerText;
  } else if (type === 'flutterwave') {
    urlText = document.getElementById('flutterwave-webhook-url-display').innerText;
  } else {
    urlText = document.getElementById('selar-webhook-url-display').innerText;
  }
  navigator.clipboard.writeText(urlText).then(() => {
    alert(type.toUpperCase() + " Webhook endpoint URL copied to clipboard! Paste this inside your integration settings.");
  }).catch(e => {
    alert("Failed to copy. Please manually select and copy the text.");
  });
}

window.triggerManualZohoDrip = async function(email, name, phone, stage) {
  try {
    const res = await fetch('/api/zoho-stage-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, phone, stage })
    });
    const data = await res.json();
    if (data.success) {
      const log = data.log || {};
      const friendlyStage = stage.replace('_', ' ').toUpperCase();
      if (log.status && (log.status.includes("Failed") || log.status.includes("Connection Failed"))) {
        alert(`⚠️ Zoho sync failed, but direct email fallback was sent!\n\nEmail Stage: ${friendlyStage}\nRecipient: ${email}\nStatus: ${log.status}\nDetails: ${log.details}`);
      } else {
        alert(`🎉 Successfully processed: ${friendlyStage}\nRecipient: ${email}\nStatus: ${log.status}\nDetails: ${log.details}`);
      }
      await loadCRMData();
    } else {
      alert("Zoho trigger returned an error: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Failed to connect to Zoho dispatcher API: " + err.message);
  }
}

async function loadCRMData() {
  const refreshBtn = document.getElementById('admin-btn-refresh');
  let icon = null;
  if (refreshBtn) {
    icon = refreshBtn.querySelector('[data-lucide="refresh-cw"]') || refreshBtn.querySelector('i');
    if (icon) icon.classList.add('animate-spin');
  }

  try {
    const response = await fetch('/api/leads');
    const data = await response.json();
    
    registrants = data.registrants || [];
    comments = data.comments || [];
    const payments = data.payments || [];
    const zohoLogs = data.zohoLogs || [];
    
    
    const regsEl = document.getElementById('stat-regs');
    if (regsEl && data.registrants) {
      regsEl.textContent = data.registrants.length;
    }

    renderLeadsList();
    renderInquiriesList();
    renderPaymentsList(payments);
    renderZohoLogsList(zohoLogs);

    const webhookDisplay = document.getElementById('selar-webhook-url-display');
    const paystackDisplay = document.getElementById('paystack-webhook-url-display');
    const flutterwaveDisplay = document.getElementById('flutterwave-webhook-url-display');
    
    if (webhookDisplay || paystackDisplay) {
      const currentDir = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
      if (webhookDisplay) webhookDisplay.innerText = currentDir + "/api/selar-webhook";
      if (paystackDisplay) paystackDisplay.innerText = currentDir + "/api/paystack-webhook";
      if (flutterwaveDisplay) flutterwaveDisplay.innerText = currentDir + "/api/flutterwave-webhook";
    }
  } catch (err) {
    console.error("Connection error loading CRM data:", err);
  } finally {
    if (icon) {
      setTimeout(() => {
        icon.classList.remove('animate-spin');
      }, 600);
    }
  }
}

function renderLeadsList() {
  const parent = document.getElementById('admin-leads-list');
  parent.innerHTML = '';
  
  if (registrants.length === 0) {
    parent.innerHTML = `<div class="p-6 text-center border border-dashed border-zinc-900 rounded-xl text-zinc-600 italic text-xs font-mono">No active lead listings found. Let webinar traffic flow!</div>`;
    return;
  }

  registrants.forEach(lead => {
    const node = document.createElement('div');
    node.className = "bg-zinc-900/40 border border-zinc-900 rounded-xl p-3.5 space-y-2 hover:border-zinc-800 transition";
    
    let badgeStyle = "bg-zinc-950 text-zinc-500 border-zinc-900";
    let badgeLabel = "📺 Watching";
    
    if (lead.status === "paid" || lead.status === "purchased") {
      badgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      badgeLabel = "💰 PAID / COMPLETED";
    } else if (lead.status === "completed") {
      badgeStyle = "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/20";
      badgeLabel = "🎓 SCHOLARSHIP CALLBACK";
    } else if (lead.status === "watching") {
      badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
      badgeLabel = "📺 STREAM WATCHING";
    }
    
    node.innerHTML = `
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-extrabold text-white uppercase tracking-wider">${lead.name}</h3>
        <span class="text-[8px] font-mono uppercase font-black px-2 py-0.5 rounded border ${badgeStyle}">${badgeLabel}</span>
      </div>
      <div class="text-[11px] font-mono text-zinc-500 space-y-1">
        <div class="flex items-center gap-1.5">
          <i data-lucide="mail" class="h-3 w-3 text-zinc-700"></i>
          <span>Email: <strong class="text-zinc-300 font-normal select-all">${lead.email}</strong></span>
        </div>
        ${lead.phone ? `
        <div class="flex items-center gap-1.5">
          <i data-lucide="phone" class="h-3 w-3 text-emerald-500"></i>
          <span>Phone: <strong class="text-emerald-400 font-bold">${lead.phone}</strong></span>
        </div>` : ''}
        <div class="flex items-center gap-1.5">
          <i data-lucide="calendar" class="h-3 w-3 text-zinc-700"></i>
          <span>Captured: ${lead.registeredAt}</span>
        </div>
        ${lead.paymentRef ? `
        <div class="flex items-center gap-1.5 text-[10px] text-zinc-500 bg-emerald-500/5 p-1 rounded border border-emerald-500/10 mt-1">
          <i data-lucide="shield-check" class="h-3 w-3 text-emerald-400"></i>
          <span>Ref: ${lead.paymentRef} | Paid: ${lead.pricePaid} ${lead.couponUsed !== 'None' ? '(' + lead.couponUsed + ')' : ''}</span>
        </div>` : ''}
      </div>

      <div class="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-zinc-900/40">
        <span class="text-[9px] text-zinc-600 font-mono mr-auto">Manual Triggers:</span>
        <button onclick="triggerManualZohoDrip('${lead.email}', '${lead.name}', '${lead.phone || ''}', 'welcome')" class="text-[9px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition" title="Force Welcome Stage">
          Welcome
        </button>
        <button onclick="triggerManualZohoDrip('${lead.email}', '${lead.name}', '${lead.phone || ''}', 'live')" class="text-[9px] px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500 transition" title="Force Live Stage">
          Live
        </button>
        <button onclick="triggerManualZohoDrip('${lead.email}', '${lead.name}', '${lead.phone || ''}', 'offer')" class="text-[9px] px-2 py-1 rounded bg-[#006fff]/10 hover:bg-[#006fff]/20 border border-[#006fff]/20 text-[#006fff] transition" title="Force Offer Stage">
          Offer
        </button>
        <button onclick="triggerManualZohoDrip('${lead.email}', '${lead.name}', '${lead.phone || ''}', 'paid')" class="text-[9px] px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition" title="Force Paid Stage">
          Paid
        </button>
        <button onclick="triggerManualZohoDrip('${lead.email}', '${lead.name}', '${lead.phone || ''}', 'special')" class="text-[9px] px-2 py-1 rounded bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/20 text-[#00E5FF] transition" title="Force Special Stage">
          Special
        </button>
      </div>
    `;
    parent.appendChild(node);
  });

  lucide.createIcons();
}

function renderPaymentsList(payments) {
  const parent = document.getElementById('admin-sales-list');
  parent.innerHTML = '';
  
  const badge = document.getElementById('sales-count-badge');
  if (badge) badge.innerText = `${payments.length} Sales`;
  
  if (payments.length === 0) {
    parent.innerHTML = `
      <div class="p-6 text-center border border-dashed border-zinc-900 rounded-xl text-zinc-600 italic text-xs font-mono">
        No sales processed yet. Webhook will log real-time Selar checkouts!
      </div>
    `;
    return;
  }
  
  payments.forEach(pay => {
    const node = document.createElement('div');
    node.className = "bg-zinc-900/40 border border-zinc-900 rounded-xl p-3.5 space-y-2 hover:border-zinc-800 transition";
    node.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-white uppercase">${pay.name}</h4>
        <span class="text-[10px] font-mono font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded">${pay.pricePaid}</span>
      </div>
      <p class="text-[10px] font-mono text-zinc-500">Email: <span class="text-zinc-300 select-all font-sans">${pay.email}</span></p>
      <div class="flex justify-between items-center text-[9px] font-mono text-zinc-600">
        <span>Coupon: <strong class="text-[#00E5FF]">${pay.couponUsed}</strong></span>
        <span>Ref: <strong class="text-zinc-400">${pay.paymentRef}</strong></span>
      </div>
      <div class="text-[8px] font-mono text-zinc-600 text-right pt-1 border-t border-zinc-950">Captured: ${pay.timestamp}</div>
    `;
    parent.appendChild(node);
  });
  lucide.createIcons();
}

function renderZohoLogsList(logs) {
  const parent = document.getElementById('admin-zoho-logs');
  parent.innerHTML = '';
  
  if (logs.length === 0) {
    parent.innerHTML = `
      <div class="p-4 text-center border border-dashed border-zinc-900 rounded-xl text-zinc-600 italic text-[10px] font-mono">
        Waiting for Zoho subscription/welcome email triggers...
      </div>
    `;
    return;
  }
  
  logs.forEach(log => {
    const node = document.createElement('div');
    node.className = "bg-zinc-950/40 border border-zinc-900 rounded-lg p-2.5 space-y-1.5 text-xs";
    
    let colorClass = "text-zinc-500";
    if (log.status.includes('Simulated')) colorClass = "text-[#00E5FF]";
    else if (log.status.includes('Synced')) colorClass = "text-emerald-400";
    else if (log.status.includes('Failed')) colorClass = "text-red-400";
    
    node.innerHTML = `
      <div class="flex items-center justify-between text-[9px]">
        <span class="font-extrabold uppercase text-[#006fff] bg-[#006fff]/10 px-2 py-0.5 rounded border border-[#006fff]/20 font-mono">${log.stage.replace('_', ' ')}</span>
        <span class="text-zinc-600 font-mono">${log.timestamp}</span>
      </div>
      <div class="text-[10px] text-zinc-400 font-sans">To: <span class="font-bold text-white">${log.name}</span> <span class="text-zinc-500 select-all font-mono">&lt;${log.email}&gt;</span></div>
      <p class="text-[10px] text-zinc-500 leading-relaxed italic border-l border-zinc-800 pl-2">"${log.details}"</p>
      <div class="text-[9px] text-right font-mono">Status: <span class="${colorClass} font-bold">${log.status}</span></div>
    `;
    parent.appendChild(node);
  });
  lucide.createIcons();
}

function renderInquiriesList() {
  const parent = document.getElementById('admin-comments-list');
  parent.innerHTML = '';
  
  const counterNode = document.getElementById('active-inquiries-count');
  const pendingCount = comments.filter(c => !c.replied).length;
  counterNode.innerText = `${pendingCount} Pending Inquiries`;

  if (comments.length === 0) {
    parent.innerHTML = `<div class="p-6 text-center border border-dashed border-zinc-900 rounded-xl text-zinc-600 italic text-xs font-mono">No viewer inquiries found on the dashboard.</div>`;
    return;
  }

  comments.forEach(comment => {
    const node = document.createElement('div');
    node.className = `border rounded-xl p-4 space-y-3.5 transition ${comment.replied ? 'bg-zinc-950/30 border-zinc-900' : 'bg-[#04091A]/60 border-amber-500/20 shadow-lg'}`;
    
    const timestampMinutes = Math.floor(comment.videoTime / 60);
    const timestampSeconds = (comment.videoTime % 60).toString().padStart(2, '0');

    node.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-zinc-200 uppercase">${comment.registrantName}</h4>
          <span class="text-[9px] font-mono text-amber-500 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/15">
            Video time: ${timestampMinutes}:${timestampSeconds}
          </span>
        </div>
        <span class="block text-[9px] font-mono text-zinc-500 font-semibold uppercase">Email: ${comment.registrantEmail}</span>
        <p class="text-xs text-zinc-400 leading-relaxed font-sans italic pt-1">"${comment.message}"</p>
      </div>

      ${comment.replied ? `
      <div class="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg space-y-1">
        <span class="block text-[8px] font-mono font-black uppercase text-emerald-400 flex items-center gap-1">
          <i data-lucide="check-circle" class="h-3 w-3"></i> Secure Outbound Email Sent via SMTP
        </span>
        <p class="text-[11px] font-sans text-zinc-500 leading-relaxed">"${comment.replyText}"</p>
      </div>
      ` : `
      <form onsubmit="replyToViewerInquiry(event, '${comment.id}')" class="space-y-2">
        <textarea
          
          placeholder="Type SMTP direct mail response to attendee..."
          class="w-full bg-[#02050E] border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/30 font-mono resize-none h-16 custom-scrollbar"
        ></textarea>
        <button
          type="submit"
          class="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-[10px] tracking-widest uppercase shadow transition cursor-pointer"
        >
          Dispatch Direct Email Response
        </button>
      </form>
      `}
    `;
    parent.appendChild(node);
  });

  lucide.createIcons();
}

window.replyToViewerInquiry = async function(event, commentId) {
  event.preventDefault();
  const textNode = event.target.querySelector('textarea');
  const replyText = textNode.value;
  if (!replyText.trim()) return;

  try {
    const response = await fetch('/api/comments/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, replyText })
    });
    const data = await response.json();
    
    await loadCRMData();
    alert(data.message || "Reply successfully dispatched!");
  } catch (err) {
    alert("Failed to send reply");
  }
}

document.getElementById('form-campaign-settings').addEventListener('submit', async (e) => {
  console.log('Submitting form...');
  e.preventDefault();
  
  
    
    console.log("Saving form...");
    const payload = {
      title: document.getElementById('sett-title') ? document.getElementById('sett-title').value : '',
      presenterName: document.getElementById('sett-presenter-name') ? document.getElementById('sett-presenter-name').value : '',
      presenterTitle: document.getElementById('sett-presenter-title') ? document.getElementById('sett-presenter-title').value : '',
      videoUrl: document.getElementById('sett-video-url') ? document.getElementById('sett-video-url').value : '',
      replayVideoUrl: document.getElementById('sett-replay-video-url') ? document.getElementById('sett-replay-video-url').value : '',
      replayExpiryHours: document.getElementById('sett-replay-expiry') ? parseInt(document.getElementById('sett-replay-expiry').value) : null,
      isRealYoutubeLive: document.getElementById('sett-is-real-youtube-live') ? document.getElementById('sett-is-real-youtube-live').checked : false,
      countdownDuration: document.getElementById('sett-wait-duration') ? parseInt(document.getElementById('sett-wait-duration').value) || 15 : 15,
      initialViewers: document.getElementById('sett-initial-viewers') ? parseInt(document.getElementById('sett-initial-viewers').value) || 1420 : 1420,
      peakViewers: document.getElementById('sett-peak-viewers') ? parseInt(document.getElementById('sett-peak-viewers').value) || 3840 : 3840,
      zoomEnabled: document.getElementById('sett-zoom-enabled') ? document.getElementById('sett-zoom-enabled').checked : false,
      zoomMeetingId: document.getElementById('sett-zoom-meeting-id') ? document.getElementById('sett-zoom-meeting-id').value : '',
      zoomPasscode: document.getElementById('sett-zoom-passcode') ? document.getElementById('sett-zoom-passcode').value : '',
      zoomEmbedUrl: document.getElementById('sett-zoom-embed-url') ? document.getElementById('sett-zoom-embed-url').value : '',
      zoomLiveMode: document.getElementById('sett-zoom-live-mode') ? document.getElementById('sett-zoom-live-mode').value : 'recording-live',
      zoomSdkKey: document.getElementById('sett-zoom-sdk-key') ? document.getElementById('sett-zoom-sdk-key').value : '',
      zoomSdkSecret: document.getElementById('sett-zoom-sdk-secret') ? document.getElementById('sett-zoom-sdk-secret').value : '',
      zohoWebinarEnabled: document.getElementById('sett-zoho-webinar-enabled') ? document.getElementById('sett-zoho-webinar-enabled').checked : false,
      zohoWebinarUrl: document.getElementById('sett-zoho-webinar-url') ? document.getElementById('sett-zoho-webinar-url').value : '',
      zoomRecordingUrl: document.getElementById('sett-zoom-recording-url') ? document.getElementById('sett-zoom-recording-url').value : '',
      alumniModeEnabled: document.getElementById('sett-alumni-enabled') ? document.getElementById('sett-alumni-enabled').checked : false,
      uniqueVisitsOnly: document.getElementById('sett-unique-visits-only') ? document.getElementById('sett-unique-visits-only').checked : false,
      landingImages: [
        document.getElementById('sett-img-1') ? document.getElementById('sett-img-1').value : '',
        document.getElementById('sett-img-2') ? document.getElementById('sett-img-2').value : '',
        document.getElementById('sett-img-3') ? document.getElementById('sett-img-3').value : '',
        document.getElementById('sett-img-4') ? document.getElementById('sett-img-4').value : ''
      ],
      offer: {
        title: document.getElementById('sett-offer-title') ? document.getElementById('sett-offer-title').value : '',
        description: document.getElementById('sett-offer-desc') ? document.getElementById('sett-offer-desc').value : '',
        price: document.getElementById('sett-offer-price') ? document.getElementById('sett-offer-price').value : '',
        paymentLink: document.getElementById('sett-offer-payment') ? document.getElementById('sett-offer-payment').value : '',
        mode: document.getElementById('sett-offer-mode') ? document.getElementById('sett-offer-mode').value : 'scheduled',
        triggerTime: document.getElementById('sett-offer-trigger') ? parseInt(document.getElementById('sett-offer-trigger').value) : 45,
        totalSlots: document.getElementById('sett-offer-slots') ? parseInt(document.getElementById('sett-offer-slots').value) : 12
      },
      zohoConfig: {
        listId: document.getElementById('sett-zoho-list-id') ? document.getElementById('sett-zoho-list-id').value : '',
        clientId: document.getElementById('sett-zoho-client-id') ? document.getElementById('sett-zoho-client-id').value : '',
        clientSecret: document.getElementById('sett-zoho-client-secret') ? document.getElementById('sett-zoho-client-secret').value : '',
        refreshToken: document.getElementById('sett-zoho-refresh-token') ? document.getElementById('sett-zoho-refresh-token').value : '',
        welcomeTemplateId: document.getElementById('sett-zoho-welcome-template') ? document.getElementById('sett-zoho-welcome-template').value : '',
        reminderTemplateId: document.getElementById('sett-zoho-reminder-template') ? document.getElementById('sett-zoho-reminder-template').value : '',
        followupTemplateId: document.getElementById('sett-zoho-followup-template') ? document.getElementById('sett-zoho-followup-template').value : '',
        followup2TemplateId: document.getElementById('sett-zoho-followup2-template') ? document.getElementById('sett-zoho-followup2-template').value : '',
        paymentTemplateId: document.getElementById('sett-zoho-payment-template') ? document.getElementById('sett-zoho-payment-template').value : ''
      }
    };




  try {
    const response = await fetch('/api/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Server returned an invalid non-JSON response. The API might be down or misconfigured on the hosting provider.");
    }
    
    const data = await response.json();
    if (response.ok && data.success) {
      alert(data.message || "Settings and Zoho email schedules committed successfully!");
      await loadCampaignSettings();
    } else {
      alert("Failed to update settings: " + (data.error || "Unknown server error"));
    }
  } catch (err) {
    if (err.message.includes("non-JSON") || err.message.includes("pattern")) {
      alert("❌ Cannot save settings from the browser on a Static Host (like Namecheap shared hosting without Node.js).\n\nTo update settings, please edit the HARDCODED_CAMPAIGN_FALLBACK section directly inside the index.html and admin.html code files.");
    } else {
      alert("Failed to update campaign parameters: " + err.message);
    }
  }
});

// Zoho Campaigns Connect Account OAuth trigger
const btnConnectZoho = document.getElementById('btn-connect-zoho');
if (btnConnectZoho) {
  btnConnectZoho.addEventListener('click', async () => {
    const clientId = document.getElementById('sett-zoho-client-id').value.trim();
    const clientSecret = document.getElementById('sett-zoho-client-secret').value.trim();

    if (!clientId || !clientSecret) {
      alert("⚠️ Configuration Required: Please enter your Zoho API Client ID and Client Secret below before connecting.");
      return;
    }

    if (!confirm("This will connect your Zoho Campaigns account. Your Client ID and Client Secret will be saved, and you will be redirected to Zoho to authorize the application. Continue?")) {
      return;
    }

    btnConnectZoho.disabled = true;
    btnConnectZoho.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Connecting...`;

    try {
      const response = await fetch('/api/zoho-auth-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret })
      });

      const data = await response.json();
      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert("Failed to start Zoho OAuth flow: " + (data.error || "Unknown server error"));
        btnConnectZoho.disabled = false;
        btnConnectZoho.innerHTML = `<i data-lucide="link" class="h-3.5 w-3.5 mr-1.5"></i><span>Connect Zoho Account</span>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }
    } catch (err) {
      alert("Failed to connect to backend server: " + err.message);
      btnConnectZoho.disabled = false;
      btnConnectZoho.innerHTML = `<i data-lucide="link" class="h-3.5 w-3.5 mr-1.5"></i><span>Connect Zoho Account</span>`;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
  });
}

// Zoho Campaigns setup initialization handler
const btnInitZoho = document.getElementById('btn-init-zoho');
if (btnInitZoho) {
  btnInitZoho.addEventListener('click', async () => {
    const clientId = document.getElementById('sett-zoho-client-id').value.trim();
    const clientSecret = document.getElementById('sett-zoho-client-secret').value.trim();
    const refreshToken = document.getElementById('sett-zoho-refresh-token').value.trim();

    if (!clientId || !clientSecret || !refreshToken) {
      alert("⚠️ Configuration Required: Please fill in your Zoho API Client ID, Client Secret, and OAuth Refresh Token fields below before initializing.");
      return;
    }

    if (!confirm("Are you sure you want to initialize/update Zoho Campaigns configurations? This will authenticate, check/create the mailing list, verify custom fields, and upload templates.")) {
      return;
    }

    const consoleDiv = document.getElementById('zoho-init-logs');
    consoleDiv.classList.remove('hidden');
    consoleDiv.innerHTML = `
      <div class="text-zinc-500 uppercase tracking-widest text-[8px] font-bold border-b border-zinc-900 pb-1.5 mb-1.5 flex items-center justify-between">
        <span>Initialization Progress Console:</span>
        <span class="text-zinc-600">June 2026</span>
      </div>
    `;

    const logToConsole = (msg, type = 'info') => {
      const line = document.createElement('div');
      if (type === 'error') {
        line.className = 'text-red-500 font-bold';
      } else if (type === 'success') {
        line.className = 'text-emerald-400 font-bold';
      } else {
        line.className = 'text-zinc-300';
      }
      line.textContent = msg;
      consoleDiv.appendChild(line);
      consoleDiv.scrollTop = consoleDiv.scrollHeight;
    };

    logToConsole("⏳ Preparing system credentials...");
    btnInitZoho.disabled = true;
    btnInitZoho.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Initializing...`;

    try {
      const response = await fetch('/api/zoho-initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, refreshToken })
      });

      const data = await response.json();
      
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach(logLine => {
          if (logLine.includes("Successfully") || logLine.includes("Completed Successfully") || logLine.includes("reusing") || logLine.includes("Reusing")) {
            logToConsole(logLine, 'success');
          } else if (logLine.includes("FATAL ERROR") || logLine.includes("failed") || logLine.includes("Warning") || logLine.includes("ERROR")) {
            logToConsole(logLine, 'error');
          } else {
            logToConsole(logLine, 'info');
          }
        });
      }

      if (response.ok && data.success) {
        logToConsole("🎉 Initialization finished with 100% success!", "success");
        if (data.updatedConfig) {
          if (data.updatedConfig.listId) {
            document.getElementById('sett-zoho-list-id').value = data.updatedConfig.listId;
          }
          if (data.updatedConfig.welcomeTemplateId) {
            document.getElementById('sett-zoho-welcome-template').value = data.updatedConfig.welcomeTemplateId;
          }
          if (data.updatedConfig.reminderTemplateId) {
            document.getElementById('sett-zoho-reminder-template').value = data.updatedConfig.reminderTemplateId;
          }
          if (data.updatedConfig.followupTemplateId) {
            document.getElementById('sett-zoho-followup-template').value = data.updatedConfig.followupTemplateId;
          }
        }
        alert("🎉 Zoho Campaigns configured and initialized successfully! Leads and templates are now fully synced.");
      } else {
        logToConsole(`❌ Error: ${data.error || 'Server processing failed'}`, 'error');
        alert("Failed during Zoho initialization: " + (data.error || "Unknown server error"));
      }
    } catch (err) {
      logToConsole(`❌ Request Exception: ${err.message}`, 'error');
      alert("Failed to contact the initialization API server: " + err.message);
    } finally {
      btnInitZoho.disabled = false;
      btnInitZoho.innerHTML = `<i data-lucide="sparkles" class="h-3.5 w-3.5 mr-1.5"></i><span>Initialize Zoho</span>`;
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  });
}

function renderSpecialLinks(offers) {
  const parent = document.getElementById('special-links-list');
  parent.innerHTML = '';
  
  if (!offers || offers.length === 0) {
    parent.innerHTML = `
      <div class="p-6 text-center border border-dashed border-zinc-900 rounded-xl text-zinc-600 italic text-xs font-mono">
        No active special webinar links found. Generate one above to invite VIP groups!
      </div>
    `;
    return;
  }
  
  offers.forEach(offer => {
    const node = document.createElement('div');
    node.className = "bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 space-y-3 hover:border-zinc-800 transition relative overflow-hidden";
    
    let expiryText = "Never Expires";
    let isExpired = false;
    if (offer.expiresAt) {
      const expTime = new Date(offer.expiresAt).getTime();
      isExpired = Date.now() > expTime;
      const dateObj = new Date(offer.expiresAt);
      expiryText = isExpired ? `Expired (${dateObj.toLocaleString()})` : `Expires: ${dateObj.toLocaleString()}`;
    }
    
    const badgeColor = isExpired ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    const statusBadge = `<span class="text-[8px] font-mono px-2 py-0.5 rounded border ${badgeColor}">${isExpired ? 'Expired' : 'Active Pass'}</span>`;
    
    const inviteUrl = window.location.origin + "/?special=" + encodeURIComponent(offer.code);
    
    node.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-xs font-black text-white uppercase tracking-wider bg-[#00E5FF]/10 border border-[#00E5FF]/20 px-2 py-0.5 rounded font-mono">${offer.code}</span>
          ${statusBadge}
        </div>
        <div class="flex items-center space-x-1.5">
          <button onclick="copySpecialLink('${inviteUrl}')" class="p-1.5 rounded-lg bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF]/30 transition cursor-pointer" title="Copy Invite Link">
            <i data-lucide="copy" class="h-3.5 w-3.5"></i>
          </button>
          <button onclick="deleteSpecialLink('${offer.code}')" class="p-1.5 rounded-lg bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-red-500 hover:border-red-500/30 transition cursor-pointer" title="Delete Special Link">
            <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
      
      <div class="text-[11px] font-mono text-zinc-500 space-y-1">
        <div>Custom Headline: <span class="text-zinc-300 font-sans">${offer.webinarTitle || 'Default'}</span></div>
        <div>Custom Presenter: <span class="text-zinc-300 font-sans">${offer.presenterName || 'Default'}</span></div>
        <div>Special Offer Price: <span class="text-[#00E5FF] font-bold font-mono">${offer.offerPrice}</span></div>
        <div class="flex items-center space-x-1">
          <i data-lucide="calendar" class="h-3.5 w-3.5 text-zinc-600"></i>
          <span>Validity: <strong class="${isExpired ? 'text-red-400 font-bold' : 'text-zinc-400'}">${expiryText}</strong></span>
        </div>
        <div class="pt-2 text-[10px] break-all select-all font-bold text-zinc-400">
          Link: <span class="text-[#00E5FF] underline cursor-pointer">${inviteUrl}</span>
        </div>
      </div>
    `;
    parent.appendChild(node);
  });
  
  lucide.createIcons();
}

window.copySpecialLink = function(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert("Special Private Webinar Invite Link copied to clipboard successfully! You can send this URL directly on WhatsApp, Telegram, or email.");
  }).catch(err => {
    alert("Copy failed. Please manually select the URL link and copy.");
  });
}

window.deleteSpecialLink = async function(code) {
  if (!confirm("Are you sure you want to delete special offer link: " + code + "? It will revert back to standard pricing/webinar state.")) return;
  campaign.specialOffers = (campaign.specialOffers || []).filter(o => o.code !== code);
  
  try {
    const response = await fetch('/api/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialOffers: campaign.specialOffers })
    });
    const data = await response.json();
    if (data.success) {
      alert("Special webinar pass deleted!");
      await loadCampaignSettings();
    } else {
      alert("Failed to delete special link: " + data.error);
    }
  } catch (err) {
    alert("Connection error deleting special link.");
  }
}

document.getElementById('form-special-offer').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newOffer = {
    code: document.getElementById('spec-code').value.trim().toLowerCase(),
    expiresAt: document.getElementById('spec-expires').value ? new Date(document.getElementById('spec-expires').value).toISOString() : null,
    webinarTitle: document.getElementById('spec-webinar-title').value.trim() || null,
    presenterName: document.getElementById('spec-presenter').value.trim() || null,
    presenterTitle: "Elite Coach & Fund Mentor, StarPips Academy",
    offerTitle: document.getElementById('spec-offer-title').value.trim() || null,
    offerPrice: document.getElementById('spec-price').value.trim(),
    paymentLink: document.getElementById('spec-selar').value.trim(),
    offerDescription: document.getElementById('spec-desc').value.trim() || null,
    active: true
  };

  if (!campaign.specialOffers) {
    campaign.specialOffers = [];
  }

  campaign.specialOffers = campaign.specialOffers.filter(o => o.code !== newOffer.code);
  campaign.specialOffers.push(newOffer);

  try {
    const response = await fetch('/api/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialOffers: campaign.specialOffers })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      alert("Success! Special Private Webinar link '" + newOffer.code + "' registered. Copy the invite link to send to clients.");
      document.getElementById('form-special-offer').reset();
      await loadCampaignSettings();
    } else {
      alert("Failed to register special webinar link: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Failed to connect to backend server.");
  }
});

document.getElementById('form-upload-material').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    title: document.getElementById('mat-title').value,
    type: document.getElementById('mat-type').value,
    includeTimestamp: document.getElementById('mat-timestamp').checked,
    content: document.getElementById('mat-content').value
  };

  try {
    const response = await fetch('/api/admin/upload-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok && data.success) {
      alert("Success! Document published and live script synchronized. Attendees will see this material alert inside the live webinar chat desk.");
      document.getElementById('form-upload-material').reset();
      await loadCampaignSettings();
    } else {
      alert("Upload failed: " + (data.error || "Unknown server error"));
    }
  } catch (err) {
    alert("Failed to connect to uploader endpoint.");
  }
});

document.getElementById('form-gemini-chat').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const topic = document.getElementById('gemini-topic').value;
  const presenter = document.getElementById('gemini-presenter').value;
  const mood = document.getElementById('gemini-mood').value;
  const submitBtn = document.getElementById('gemini-submit-btn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="animate-spin" data-lucide="loader"></i> <span>Formulating AI Script...</span>`;
  lucide.createIcons();

  try {
    const response = await fetch('/api/gemini/generate-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, presenter, mood })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      if (data.fallback) {
        alert("Notice: Gemini API is unconfigured or returned an error. Successfully generated 12 highly realistic local fallback timeline comments for: " + topic);
      } else {
        alert("Success! Generated 12 highly realistic, niche timeline messages with Gemini AI!");
      }
      await loadCampaignSettings();
    } else {
      alert("Generation failed: " + (data.error || "Unknown server error"));
      await loadCampaignSettings();
    }
  } catch (err) {
    alert("Error invoking Gemini API: " + err.message + ". Reverting to custom local algorithmic fallback script.");
    await loadCampaignSettings();
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i data-lucide="brain" class="h-4 w-4"></i> <span>Generate Synchronized Chat Script</span>`;
    lucide.createIcons();
  }
});

document.getElementById('admin-btn-clear').addEventListener('click', async () => {
  if (!confirm("⚠️ WARNING: This will permanently wipe all captured registrant emails, phone scholarship callbacks, and active attendee Q&A questions. Proceed?")) return;
  try {
    await fetch('/api/leads/clear', { method: 'POST' });
    await loadCRMData();
    alert("CRM database logs successfully flushed clean!");
  } catch (err) {
    alert("Failed to clear CRM database");
  }
});

const btnSimSelar = document.getElementById('btn-sim-selar');
if (btnSimSelar) {
  btnSimSelar.addEventListener('click', async () => {
    const emailEl = document.getElementById('sim-selar-email');
    const email = emailEl ? emailEl.value.trim() : '';
    if (!email) {
      alert("Please enter a test email first!");
      return;
    }

    const payload = {
      name: "Sandbox Tester",
      email: email,
      amount: 147,
      coupon: "VIP50"
    };

    try {
      const response = await fetch('/api/admin/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok && data.success) {
        alert(`Success! Simulated payment processed. Subscriber ${payload.email} upgraded to paid status, and Zoho payment confirmation dispatched.`);
        if (emailEl) emailEl.value = '';
        await loadCRMData();
      } else {
        alert("Simulation failed: " + (data.error || "Unknown server error"));
      }
    } catch (err) {
      alert("Connection error executing Sandbox Billing simulation.");
    }
  });
}

// Parsed zoom chat log storage
let parsedChatLog = [];

function parseZoomChatLog(text, offsetSeconds = 0) {
  const lines = text.split('\n');
  const chatScript = [];
  
  // Robust time regex supporting [00:12:34], 00:12:34, [12:34], 12:34, with optional milliseconds
  const timeRegex = /^(?:\[?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?\]?|\[?(\d{1,2}):(\d{2})(?:\.\d+)?\]?)\s*(.*)$/;
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const match = trimmed.match(timeRegex);
    if (match) {
      let seconds = 0;
      let content = "";
      
      if (match[1] !== undefined) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const s = parseInt(match[3], 10);
        seconds = h * 3600 + m * 60 + s;
        content = match[6];
      } else if (match[4] !== undefined) {
        const m = parseInt(match[4], 10);
        const s = parseInt(match[5], 10);
        seconds = m * 60 + s;
        content = match[6];
      }

      // Apply offset (e.g. for absolute time-of-day chat logs, offset subtracts the recording start time)
      seconds -= offsetSeconds;
      if (seconds < 0) return; // Skip messages that occurred before the video recording started

      
      if (content) {
        let senderName = "Participant";
        let message = "";
        
        let cleanContent = content.trim();
        const lowerContent = cleanContent.toLowerCase();
        if (lowerContent.includes("started recording") || lowerContent.includes("joined the meeting") || lowerContent.includes("left the meeting")) {
          return;
        }

        if (cleanContent.toLowerCase().startsWith("from ")) {
          cleanContent = cleanContent.substring(5).trim();
        }
        
        const colonIndex = cleanContent.indexOf(':');
        if (colonIndex > 0) {
          let namePart = cleanContent.substring(0, colonIndex).trim();
          message = cleanContent.substring(colonIndex + 1).trim();
          
          namePart = namePart
            .replace(/\s+to\s+Everyone.*/i, '')
            .replace(/\s+to\s+Host\s+&.*/i, '')
            .replace(/\s+to\s+All\s+Panelists.*/i, '')
            .replace(/\s*\(Privately\)/i, '')
            .replace(/\s*\(Host\)/i, '')
            .replace(/\s*\(Panelist\)/i, '')
            .trim();
            
          senderName = namePart || "Participant";
        } else {
          const spaceIndex = cleanContent.indexOf(' ');
          if (spaceIndex > 0) {
            senderName = cleanContent.substring(0, spaceIndex).trim();
            message = cleanContent.substring(spaceIndex + 1).trim();
          } else {
            message = cleanContent;
          }
        }
        
        if (message) {
          const commentId = 'chat_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
          chatScript.push({
            id: commentId,
            timestamp: seconds,
            senderName: senderName,
            message: message,
            isPresenter: senderName.toLowerCase().includes('highpriest') || senderName.toLowerCase().includes('coach') || senderName.toLowerCase().includes('admin') || senderName.toLowerCase().includes('host')
          });
        }
      }
    }
  });
  
  return chatScript.sort((a, b) => a.timestamp - b.timestamp);
}

function setupZoomChatLogUploader() {
  const dropzone = document.getElementById('chat-upload-dropzone');
  const fileInput = document.getElementById('chat-file-input');
  const statusBox = document.getElementById('parse-status-box');
  const countSpan = document.getElementById('parsed-count');
  const sampleP = document.getElementById('parse-sample');
  const btnSave = document.getElementById('btn-save-parsed');
  const btnClear = document.getElementById('btn-clear-parsed');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-amber-500', 'bg-amber-500/10');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-amber-500', 'bg-amber-500/10');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-amber-500', 'bg-amber-500/10');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleChatFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleChatFile(e.target.files[0]);
    }
  });

  function handleChatFile(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      
      let offsetSeconds = 0;
      const offsetInput = document.getElementById('sett-chat-sync-offset');
      if (offsetInput && offsetInput.value.trim()) {
        const val = offsetInput.value.trim();
        const parts = val.split(':');
        if (parts.length === 3) {
          offsetSeconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        } else if (parts.length === 2) {
          offsetSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
      }

      parsedChatLog = parseZoomChatLog(text, offsetSeconds);
      if (parsedChatLog.length === 0) {
        alert("Could not parse any valid chat logs. Please ensure the file contains timestamps (e.g., [00:10:23] Name: Message or 00:10:23 Name: Message)");
        statusBox.classList.add('hidden');
        return;
      }
      
      countSpan.innerText = parsedChatLog.length;
      const sampleText = parsedChatLog.slice(0, 2).map(m => `[${m.timestamp}s] ${m.senderName}: ${m.message}`).join(' | ');
      sampleP.innerText = "Sample: " + sampleText;
      statusBox.classList.remove('hidden');
    };
    reader.readAsText(file);
  }

  btnClear.addEventListener('click', (e) => {
    e.stopPropagation();
    parsedChatLog = [];
    fileInput.value = '';
    statusBox.classList.add('hidden');
  });

  btnSave.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (parsedChatLog.length === 0) return;
    
    if (!confirm(`Are you sure you want to merge these ${parsedChatLog.length} parsed comments into your live stream webinar script?`)) {
      return;
    }

    try {
      const mergedScript = [...(campaign.chatScript || []), ...parsedChatLog];
      
      const response = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatScript: mergedScript })
      });

      if (response.ok) {
        alert(`Successfully injected ${parsedChatLog.length} chat logs!`);
        parsedChatLog = [];
        fileInput.value = '';
        statusBox.classList.add('hidden');
        await loadCampaignSettings();
      } else {
        alert("Failed to save chat logs to server settings");
      }
    } catch (err) {
      alert("Error saving: " + err.message);
    }
  });
}

async function loadMysqlConfig() {
  try {
    const response = await fetch('/api/mysql-config', { credentials: 'include' });
    if (response.ok) {
      const config = await response.json();
      const hostEl = document.getElementById('mysql-host');
      const dbEl = document.getElementById('mysql-db');
      const userEl = document.getElementById('mysql-user');
      const passEl = document.getElementById('mysql-pass');
      const enabledEl = document.getElementById('mysql-enabled');

      if (hostEl) hostEl.value = config.host || '';
      if (dbEl) dbEl.value = config.database || '';
      if (userEl) userEl.value = config.user || '';
      if (passEl) passEl.value = config.password || '';
      if (enabledEl) enabledEl.checked = !!config.enabled;
    }
  } catch (err) {
    console.error("Failed to load MySQL config:", err);
  }
}

function setupMysqlConfigActions() {
  const btnSave = document.getElementById('btn-save-mysql');
  if (!btnSave) return;

  btnSave.addEventListener('click', async (e) => {
    e.preventDefault();
    const payload = {
      host: document.getElementById('mysql-host').value.trim(),
      database: document.getElementById('mysql-db').value.trim(),
      user: document.getElementById('mysql-user').value.trim(),
      password: document.getElementById('mysql-pass').value,
      enabled: document.getElementById('mysql-enabled').checked
    };

    try {
      const response = await fetch('/api/mysql-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok && data.success) {
        alert(data.message || "MySQL Configuration saved successfully!");
        // Reload settings and CRM data in case backend switched
        await loadCampaignSettings();
        await loadCRMData();
      } else {
        alert("Failed to save MySQL config: " + (data.error || "Unknown server error"));
      }
    } catch (err) {
      alert("Error saving MySQL configuration: " + err.message);
    }
  });
}

window.onload = async () => {
  // Check if we just redirected back from Zoho successfully
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('zoho_connected') === 'true') {
    window.history.replaceState({}, document.title, window.location.pathname);
    alert("🎉 Zoho Campaigns connected successfully! Your Refresh Token has been securely generated and saved. You can now run the Zoho initialization!");
  }

  // 1. Setup interactive UI event listeners first so the admin dashboard is ALWAYS responsive and active
  try {
    setupZoomChatLogUploader();
  } catch (e) {
    console.error("Error setting up Zoom chat log uploader:", e);
  }
  try {
    setupMysqlConfigActions();
  } catch (e) {
    console.error("Error setting up MySQL config actions:", e);
  }
  try {
    lucide.createIcons();
  } catch (e) {
    console.error("Error initializing Lucide icons:", e);
  }

  // 2. Load settings and data in background so any server or DB issues don't lock up the dashboard
  try {
    await loadCampaignSettings();
  } catch (e) {
    console.error("Failed to load campaign settings:", e);
  }
  try {
    await loadCRMData();
  } catch (e) {
    console.error("Failed to load CRM data:", e);
  }
  try {
    await loadMysqlConfig();
  } catch (e) {
    console.error("Failed to load MySQL config:", e);
  }

  // 3. Background polling has been disabled to prevent unnecessary resource consumption and stay within serverless/KV API limits.
  // The admin can manually refresh data using the "Refresh Data" button on the UI.
};
const trackingForm = document.getElementById('tracking-form');
  if (trackingForm) {
    trackingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        tracking: {
          fbPixel: document.getElementById('track-fb').value.trim(),
          tiktokPixel: document.getElementById('track-tk').value.trim(),
          gaPixel: document.getElementById('track-ga').value.trim()
        }
      };
      
      const btn = e.target.querySelector('button');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader-2" class="h-3.5 w-3.5 animate-spin"></i><span>SAVING...</span>';
      
      try {
        const res = await fetch('/api/campaign-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
          btn.classList.remove('bg-purple-500/20', 'text-purple-400');
          btn.classList.add('bg-[#00E5FF]/20', 'text-[#00E5FF]');
          btn.innerHTML = '<i data-lucide="check" class="h-3.5 w-3.5"></i><span>SAVED</span>';
          setTimeout(() => {
            btn.classList.add('bg-purple-500/20', 'text-purple-400');
            btn.classList.remove('bg-[#00E5FF]/20', 'text-[#00E5FF]');
            btn.innerHTML = originalText;
            lucide.createIcons();
          }, 2000);
        } else {
          alert("Error: " + data.error);
          btn.innerHTML = originalText;
        }
      } catch (err) {
        alert("Request failed.");
        btn.innerHTML = originalText;
      }
    });
  }


window.quillEditors = {};



document.addEventListener('click', async (e) => {
  
});

function copyReplayLink() {
  const link = document.getElementById('replay-page-link-display').value;
  if(link) {
    navigator.clipboard.writeText(link);
    alert('Replay Link copied to clipboard!');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('replay-page-link-display')) {
    document.getElementById('replay-page-link-display').value = window.location.origin + '/replay?email=$[EMAIL]$';
  }
});

window.triggerGlobalZohoSync = async function(stage) {
  if (!confirm(`Are you sure you want to run global recovery for '${stage}'? This will attempt to send to all leads who missed it.`)) return;
  
  try {
    const res = await fetch('/api/admin/global-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      await loadCRMData();
    } else {
      alert("Error: " + data.error);
    }
  } catch(err) {
    alert("Connection error executing global sync.");
  }
};
