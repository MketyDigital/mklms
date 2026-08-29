/**
 * StarPips Ultimate White-Labeled Live Webinar Video Player Engine
 * Handles seamless, bulletproof, un-clickable simulated live playback
 * for both raw MP4 video streams and unlisted/public YouTube videos.
 */

// Global player references
window.ytPlayer = null;
window.ytPlayerReady = false;
window.playerSetupStarted = false;

// Local variables to manage YouTube state and dynamic blocker fading
let blockerTimeout = null;
let currentYtState = -1;

function handleYtPlayerState(state) {
  currentYtState = state;
  console.log("[YouTube Player Message State]:", state);
  const ytBlocker = document.getElementById('youtube-ui-blocker');
  if (!ytBlocker) return;

  if (state === 1) { // PLAYING
    console.log("[YouTube Player] Video is now playing. Scheduling blocker fade out...");
    if (blockerTimeout) clearTimeout(blockerTimeout);
    
    /* 
     ================================================================================
     ADJUSTMENT POINT: YOUTUBE CONTROLS BLOCKER FADE-OUT DELAY (DEFAULT: 4000ms)
     If the YouTube player controls or titles are still peeping through before the 
     black curtain fades out, INCREASE this millisecond value (e.g., 4500 or 5000).
     If you want the video to show faster and don't mind the controls, DECREASE it.
     ================================================================================
    */
    const fadeOutDelayMs = 4000; 

    blockerTimeout = setTimeout(() => {
      // Double check that we are still in PLAYING state and have clicked to play
      if (currentYtState === 1 && window.clickedToPlay) {
        ytBlocker.classList.remove('opacity-100');
        ytBlocker.classList.add('opacity-0');
        console.log("[YouTube Player] Blocker faded out seamlessly.");
      }
    }, fadeOutDelayMs); 
  } else if (state === 2) { // PAUSED
    console.log("[YouTube Player] Video is paused. Showing resume overlay...");
    if (blockerTimeout) clearTimeout(blockerTimeout);
    if (window.clickedToPlay) {
      ytBlocker.classList.remove('opacity-0');
      ytBlocker.classList.add('opacity-100');
      
      const clickOverlay = document.getElementById('video-click-overlay');
      if (clickOverlay) {
        clickOverlay.classList.remove('hidden', 'opacity-0');
        const interactiveContent = document.getElementById('overlay-interactive-content');
        const bufferingContent = document.getElementById('overlay-buffering-content');
        if (interactiveContent) interactiveContent.classList.remove('hidden');
        if (bufferingContent) bufferingContent.classList.add('hidden');
        const btn = document.getElementById('unmute-cta-btn');
        if (btn) btn.innerHTML = `<i data-lucide="play" class="h-4 w-4 stroke-[3]"></i><span>RESUME BROADCAST</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  } else if (state === 3 || state === -1) { // BUFFERING, UNSTARTED
    console.log("[YouTube Player] Video is buffering or cued. Showing solid black blocker to hide YT controls...");
    if (blockerTimeout) clearTimeout(blockerTimeout);
    if (window.clickedToPlay) {
      ytBlocker.classList.remove('opacity-0');
      ytBlocker.classList.add('opacity-100');
    }
  } else if (state === 0) { // ENDED
    console.log("[YouTube Player] Video ended.");
    if (typeof window.handleVideoEnd === 'function') {
      window.handleVideoEnd();
    }
  }
}

// Global message listener to subscribe to YouTube player messages
window.addEventListener('message', (e) => {
  let data;
  if (typeof e.data === 'string') {
    try {
      data = JSON.parse(e.data);
    } catch (err) {
      return; // Ignore invalid JSON strings
    }
  } else if (typeof e.data === 'object' && e.data !== null) {
    data = e.data;
  } else {
    return;
  }

  // Handle standard YT events
  let state = null;
  if (data.event === 'onStateChange') {
    state = data.info;
  } else if (data.info && typeof data.info.playerState !== 'undefined') {
    state = data.info.playerState;
  }

  // Dynamically extract duration if available from YouTube infoDelivery
  if (data.info && typeof data.info.duration !== 'undefined' && data.info.duration > 0) {
    if (window.currentCampaign) {
      window.currentCampaign.videoDuration = Math.ceil(data.info.duration);
      console.log("[YouTube Player] Dynamically updated campaign duration from YouTube metadata:", window.currentCampaign.videoDuration);
    }
  }

  if (state !== null) {
    handleYtPlayerState(state);
  }
});

// Expose variables globally for compatibility with index.js
Object.defineProperty(window, 'ytPlayer', {
  get: () => window._ytPlayer || null,
  set: (val) => { window._ytPlayer = val; },
  configurable: true
});
Object.defineProperty(window, 'ytPlayerReady', {
  get: () => window._ytPlayerReady || false,
  set: (val) => { window._ytPlayerReady = val; },
  configurable: true
});

// Local helper to determine if URL is a webpage/embed
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

// Helpers to get YouTube ID
function getYoutubeVideoId(url) {
  if (!url) return null;
  
  // Normalize string
  url = url.trim();
  
  // 1. Check for youtu.be/VIDEO_ID
  if (url.includes('youtu.be/')) {
    const parts = url.split('youtu.be/');
    if (parts[1]) {
      const id = parts[1].split(/[?#]/)[0].trim();
      if (id.length === 11) return id;
    }
  }
  
  // 2. Check for path patterns: /shorts/ID, /embed/ID, /live/ID, /v/ID
  const patterns = ['/shorts/', '/embed/', '/live/', '/v/'];
  for (const pattern of patterns) {
    if (url.includes(pattern)) {
      const parts = url.split(pattern);
      if (parts[1]) {
        const id = parts[1].split(/[?#&]/)[0].trim();
        if (id.length === 11) return id;
      }
    }
  }
  
  // 3. Check for standard watch?v=ID query parameter
  if (url.includes('v=')) {
    const parts = url.split('v=');
    if (parts[1]) {
      const id = parts[1].split(/[?#&]/)[0].trim();
      if (id.length === 11) return id;
    }
  }

  // 4. Fallback Regex
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|\&v=)([^#\&\?]{11})/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  
  return null;
}

// Helpers to get Gumlet ID
function getGumletVideoId(url) {
  if (!url) return null;
  url = url.trim();
  // Ignore direct stream links (HLS or DASH) so they fall back to native/HLS player
  if (url.includes('.m3u8') || url.includes('.mpd') || url.includes('/hls/')) {
    return null;
  }
  if (url.includes('gumlet.com') || url.includes('gumlet.io') || url.includes('gumlet.tv')) {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/');
    // Check if any part is a 24-character hexadecimal ID
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part && part.length === 24 && /^[0-9a-fA-F]+$/.test(part)) {
        return part;
      }
    }
    // Fallback if it is not 24 hex chars but still valid
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part && part.length >= 8 && part !== 'embed' && part !== 'single') {
        return part;
      }
    }
  }
  return null;
}

function initGumletPlayer(videoId, startOffsetSec) {
  return new Promise((resolve) => {
    const container = document.getElementById('gumlet-player-container');
    if (!container) {
      console.error("[Gumlet Player] #gumlet-player-container element not found in DOM.");
      resolve(null);
      return;
    }
    container.innerHTML = '';
    
    // Embed with query parameters to turn off title, keyboard shortcuts, seeking, and controls
    let embedUrl = `https://play.gumlet.io/embed/${videoId}?autoplay=1&muted=1&controls=0&title=0&keyboard=0&disable_seek=1&byline=0&portrait=0`;
    if (startOffsetSec > 0) {
      embedUrl += `&t=${startOffsetSec}`;
    }
    
    const iframe = document.createElement('iframe');
    iframe.id = 'gumlet-player-iframe';
    iframe.className = "w-full h-full absolute inset-0 border-none pointer-events-none z-0";
    iframe.src = embedUrl;
    iframe.allow = "autoplay; encrypted-media; fullscreen";
    iframe.setAttribute('allowFullScreen', '');
    
    container.appendChild(iframe);
    
    // Bind window-wide wrapper window._gumletPlayer for general control
    const GumletPlayerClass = window.playerjs && window.playerjs.Player;
    
    if (GumletPlayerClass) {
      console.log("[Gumlet SDK] Initializing player via Player SDK class");
      const player = new GumletPlayerClass(iframe);
      
      window._gumletPlayer = {
        unMute: () => {
          if (player.unmute) {
            player.unmute().catch(e => console.warn("[Gumlet SDK] unmute failed:", e));
          } else {
            // fallback if it uses setMuted
            player.setMuted && player.setMuted(false).catch(e => console.warn("[Gumlet SDK] setMuted failed:", e));
          }
        },
        setVolume: (vol) => {
          player.setVolume(vol).catch(e => console.warn("[Gumlet SDK] setVolume failed:", e));
        },
        playVideo: () => {
          return player.play().catch(e => {
            console.warn("[Gumlet SDK] play failed:", e);
            throw e;
          });
        },
        seekTo: (sec, allowSeekAhead) => {
          player.setCurrentTime(sec).catch(e => console.warn("[Gumlet SDK] setCurrentTime failed:", e));
        }
      };
      
      player.on('ended', () => {
        console.log("[Gumlet Player SDK] Video ended event fired.");
        if (typeof window.handleVideoEnd === 'function') {
          window.handleVideoEnd();
        }
      });
      
      player.on('play', () => { window._gumletIsPlaying = true; });
      player.on('pause', () => { window._gumletIsPlaying = false; });
      
      player.on('error', (err) => {
        console.error("[Gumlet Player SDK Error]:", err);
      });
      
      player.on('ready', () => {
        console.log("[Gumlet Player SDK] Player is ready.");
        window._gumletPlayerReady = true;
        resolve(window._gumletPlayer);
      });
    } else {
      console.warn("[Gumlet Player SDK] SDK script not detected on window. Loading postMessage command interface fallback...");
      
      window._gumletPlayer = {
        unMute: () => {
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'setMuted', value: false }), '*');
        },
        setVolume: (vol) => {
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'setVolume', value: vol / 100 }), '*');
        },
        playVideo: () => {
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'play' }), '*');
          return Promise.resolve();
        },
        seekTo: (sec, allowSeekAhead) => {
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: sec }), '*');
        }
      };
      
      const fallbackListener = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'ended' || msg.method === 'ended') {
            console.log("[Gumlet Fallback] Video ended event received via postMessage.");
            if (typeof window.handleVideoEnd === 'function') {
              window.handleVideoEnd();
            }
          }
          if (msg.event === 'play' || msg.method === 'play') {
            window._gumletIsPlaying = true;
          }
          if (msg.event === 'pause' || msg.method === 'pause') {
            window._gumletIsPlaying = false;
          }
        } catch (e) {}
      };
      window.addEventListener('message', fallbackListener);
      
      window._gumletPlayerReady = true;
      resolve(window._gumletPlayer);
    }
  });
}

function ensureYoutubeApiLoaded() {
  // Deprecated: We now use fully decoupled postMessage direct iframe injection to ensure 100% control
}

function initYoutubePlayer(videoId, startOffsetSec, onStateChangeCallback) {
  return new Promise((resolve) => {
    const container = document.getElementById('youtube-player-container');
    container.innerHTML = '';
    
    // Explicitly set autoplay=1 and mute=1 so it starts silently in the background immediately!
    let embedUrl = `https://www.youtube.com/embed/${videoId}?controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&enablejsapi=1&iv_load_policy=3&autoplay=1&mute=1`;
    if (startOffsetSec > 0) {
      embedUrl += `&start=${startOffsetSec}`;
    }
    
    const iframe = document.createElement('iframe');
    iframe.id = 'youtube-player';
    iframe.className = "w-[104%] h-[104%] absolute -top-[2%] -left-[2%] pointer-events-none z-0";
    iframe.src = embedUrl;
    iframe.allow = "autoplay; encrypted-media; fullscreen";
    iframe.setAttribute('allowFullScreen', '');
    
    // Mock the YT Player object interface so the rest of the app doesn't break
    window._ytPlayer = {
      unMute: () => {
         iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'unMute' }), '*');
      },
      setVolume: (vol) => {
         iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), '*');
      },
      playVideo: () => {
         iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
      },
      seekTo: (sec, allowSeekAhead) => {
         iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [sec, allowSeekAhead] }), '*');
      }
    };
    
    container.appendChild(iframe);
    
    // Setup a blocker inside container to hide YouTube titles when playing starts
    const blocker = document.createElement('div');
    blocker.id = 'youtube-ui-blocker';
    blocker.className = 'absolute inset-0 z-30 pointer-events-none opacity-0 bg-black transition-opacity duration-[500ms]';
    container.appendChild(blocker);

    // Give iframe time to initialize API endpoint
    setTimeout(() => {
      window._ytPlayerReady = true;
      resolve(window._ytPlayer);
    }, 1500);
  });
}

// Separate white-label custom live video setup
async function setupVideoPlayer() {
  if (localStorage.getItem('webinar_ended_state') === 'true') {
    console.log("[Player Setup] Webinar previously ended. Keeping offline state.");
    if (typeof window.handleVideoEnd === 'function') {
      window.handleVideoEnd();
    }
    return;
  }

  // Ensure idempotent initialization
  if (window.playerSetupStarted) {
    console.log("[Player Setup] Player already initialized, skipping duplicate setup.");
    return;
  }
  window.playerSetupStarted = true;

  console.log("[Player Setup] Pre-buffering player elements in the background...");

  const vid = document.getElementById('main-video-player');
  const clickOverlay = document.getElementById('video-click-overlay');
  const bufferOverlay = document.getElementById('live-connection-overlay');
  const touchShield = document.getElementById('video-touch-shield');
  const blackoutCurtain = document.getElementById('video-blackout-curtain');
  
  // Track overlay click status globally or locally
  window.clickedToPlay = false;
  window._ytHasSeeked = false;
  window._vidHasSeeked = false;

  if (touchShield) {
    touchShield.classList.add('hidden'); // Reset initially so overlay click can trigger
    
    // Strict block of pointer/touch events so mobile users can never bypass the shield to see YouTube controls
    const blockEvent = (e) => {
      e.stopPropagation();
    };
    touchShield.addEventListener('click', blockEvent);
    touchShield.addEventListener('mousedown', blockEvent);
    touchShield.addEventListener('touchstart', blockEvent, { passive: true });
    touchShield.addEventListener('touchend', blockEvent, { passive: true });
    touchShield.addEventListener('touchmove', blockEvent, { passive: true });
    touchShield.addEventListener('contextmenu', blockEvent);
  }
  
  if (bufferOverlay) {
    bufferOverlay.classList.add('hidden'); // Skip any artificial delay screens on play
  }
  
  // Clean state resets
  document.getElementById('zoom-player-container').classList.add('hidden');
  document.getElementById('youtube-player-container').classList.add('hidden');
  
  const isZoomLive = currentCampaign.zoomEnabled;
  const isZoomWebSdkActive = isZoomLive && (currentCampaign.zoomLiveMode === 'web-sdk') && (currentCampaign.zoomEmbedUrl || currentCampaign.zoomMeetingId);

  // Configure copyable zoom access card values & visibility
  const zoomAccessCard = document.getElementById('zoom-access-card');
  if (isZoomLive && zoomAccessCard) {
    zoomAccessCard.classList.remove('hidden');
    document.getElementById('zoom-card-name').innerText = currentLead?.name || "VIP Attendee";
    document.getElementById('zoom-card-pass').innerText = currentCampaign.zoomPasscode || "None";
  } else if (zoomAccessCard) {
    zoomAccessCard.classList.add('hidden');
  }

  // Calculate if there's any elapsed time offset from original webinar start
  const registeredAtStr = localStorage.getItem('webinar_registered_at');
  let startOffsetSec = 0;
  if (registeredAtStr && !currentCampaign.isRealYoutubeLive) {
    const registeredAt = parseInt(registeredAtStr, 10);
    const countdownDurationSec = currentCampaign.countdownDuration || 15;
    const webinarStartMs = registeredAt + (countdownDurationSec * 1000);
    const elapsedMs = Date.now() - webinarStartMs;
    if (elapsedMs > 0) {
      startOffsetSec = Math.floor(elapsedMs / 1000);
    }
  }

  /* 
   ================================================================================
   ADJUSTMENT POINT: CAMPAIGN VIDEO DURATION LIMITS
   Originally, the player would block and skip setup if the calculated startOffset 
   exceeded the campaign's videoDuration. As requested, we have removed this 
   hardcoded clock limit so the stream never turns offline prematurely. It will 
   now only go offline when the video player itself actually reaches its end.
   ================================================================================
  */

  const activeStreamUrl = (isZoomLive && currentCampaign.zoomRecordingUrl) ? currentCampaign.zoomRecordingUrl : (currentCampaign.zoomRecordingUrl || currentCampaign.videoUrl);

  // Determine active media type
  let resolvedUrl = activeStreamUrl;
  let gumletId = getGumletVideoId(activeStreamUrl);
  let ytId = getYoutubeVideoId(activeStreamUrl);
  let resolvedType = gumletId ? 'gumlet' : (ytId ? 'youtube' : (isWebpageUrl(activeStreamUrl) ? 'iframe' : 'video'));

  window._resolvedPlayerType = resolvedType;
  window.activeStreamUrl = activeStreamUrl;

  // Pre-bind the click handler immediately so that there is absolutely zero delay or blocking for the user!
  const handleOverlayClick = () => {
    console.log("[Player Click] User engaged play stream...");
    
    const isInitialClick = !window.clickedToPlay;

    // Switch overlay content from interactive button to secure connecting buffering state
    const interactiveContent = document.getElementById('overlay-interactive-content');
    const bufferingContent = document.getElementById('overlay-buffering-content');
    if (interactiveContent) interactiveContent.classList.add('hidden');
    if (bufferingContent) bufferingContent.classList.remove('hidden');

    window.clickedToPlay = true;
    
    if (!isInitialClick) {
      window._gumletHasSeeked = false;
      window._ytHasSeeked = false;
      window._vidHasSeeked = false;
    } else {
      // Always force a re-seek on the first click so that even if the iframe ignored the start parameter, it syncs up
      window._gumletHasSeeked = false;
      window._ytHasSeeked = false;
      window._vidHasSeeked = false;
    }

    // Recalculate startOffsetSec to match actual live elapsed playtime since webinar started (handles refresh perfectly!)
    const registeredAtStr = localStorage.getItem('webinar_registered_at');
    let liveStartOffsetSec = 0;
    if (registeredAtStr && !currentCampaign.isRealYoutubeLive) {
      const registeredAt = parseInt(registeredAtStr, 10);
      const countdownDurationSec = currentCampaign.countdownDuration || 15;
      const webinarStartMs = registeredAt + (countdownDurationSec * 1000);
      const elapsedMs = Date.now() - webinarStartMs;
      if (elapsedMs > 0) {
        liveStartOffsetSec = Math.floor(elapsedMs / 1000);
      }
    }

    // Attempt direct synchronous play and unmute
    const triggerAudioUnmute = () => {
      // Re-read latest live timing for ongoing sync
      let currentLiveOffset = liveStartOffsetSec;
      const rAt = localStorage.getItem('webinar_registered_at');
      if (rAt) {
        const rTime = parseInt(rAt, 10);
        const cDur = currentCampaign.countdownDuration || 15;
        const eMs = Date.now() - (rTime + (cDur * 1000));
        if (eMs > 0) {
          currentLiveOffset = Math.floor(eMs / 1000);
        }
      }

      if (resolvedType === 'gumlet') {
        if (window._gumletPlayer) {
          try {
            window._gumletPlayer.unMute();
            window._gumletPlayer.setVolume(100);
            if (currentLiveOffset > 0 && !window._gumletHasSeeked) {
              window._gumletPlayer.seekTo(currentLiveOffset, true);
              window._gumletHasSeeked = true;
            }
            window._gumletPlayer.playVideo();
          } catch (err) {
            console.warn("[Gumlet API Retry] Retrying unmuted play...", err);
          }
        }
      } else if (resolvedType === 'youtube') {
        if (window._ytPlayer) {
          try {
            window._ytPlayer.unMute();
            window._ytPlayer.setVolume(100);
            if (currentLiveOffset > 0 && !window._ytHasSeeked) {
              window._ytPlayer.seekTo(currentLiveOffset, true);
              window._ytHasSeeked = true;
            }
            window._ytPlayer.playVideo();
          } catch (err) {
            console.warn("[YouTube API Retry] Retrying unmuted play...", err);
          }
        }
      } else if (resolvedType === 'video') {
        vid.muted = false;
        vid.volume = 1.0;
        vid.play().then(() => {
          if (currentLiveOffset > 0 && currentLiveOffset < vid.duration && !window._vidHasSeeked) {
            vid.currentTime = currentLiveOffset;
            window._vidHasSeeked = true;
          }
        }).catch((err) => {
          console.warn("[Native Player Retry] Autoplay error, retrying...", err);
        });
      }
    };

    // Execute first unmute play attempt instantly
    triggerAudioUnmute();

    // Show the UI blocker so when the overlay fades, the top/bottom are covered for a bit
    const ytBlocker = document.getElementById('youtube-ui-blocker');
    if (ytBlocker && resolvedType === 'youtube') {
      ytBlocker.classList.remove('opacity-0');
      ytBlocker.classList.add('opacity-100');
    }

    // Transition timeline safely
    startLiveTimeline();

    // Smoothly fade out the entire solid curtain overlay after exactly 2.5 seconds
    setTimeout(() => {
      if (clickOverlay) {
        clickOverlay.classList.add('opacity-0');
        setTimeout(() => {
          clickOverlay.classList.add('hidden');
          
          // Hide UI blocker a few seconds later as a foolproof fail-safe
          if (ytBlocker) {
             setTimeout(() => {
               ytBlocker.classList.remove('opacity-100');
               ytBlocker.classList.add('opacity-0');
             }, 500);
          }
          
          // Activate touch block shield so they cannot trigger youtube overlay controls on tap
          if (touchShield) {
            touchShield.classList.remove('hidden');
          }
        }, 1000);
      }
    }, 2500);
  };

  if (resolvedType === 'gumlet') {
    if (blackoutCurtain) blackoutCurtain.classList.add('hidden');
    
    // For gumlet, we want to show the transparent unmute overlay instead of the big blackout
    if (clickOverlay) {
      clickOverlay.classList.remove('hidden', 'bg-zinc-950');
      clickOverlay.classList.add('bg-black/60', 'backdrop-blur-sm');
      clickOverlay.onclick = handleOverlayClick;
    }
    
    const gumletContainer = document.getElementById('gumlet-player-container');
    if (gumletContainer) {
      gumletContainer.classList.remove('hidden');
      // Keep pointer-events-none so the user cannot click the player to pause it
    }
  } else {
    if (clickOverlay) {
      clickOverlay.classList.remove('hidden', 'bg-black/60', 'backdrop-blur-sm');
      clickOverlay.classList.add('bg-zinc-950');
      clickOverlay.onclick = handleOverlayClick;
    }
  }

  // Now resolve the stream URL in the background
  if (activeStreamUrl && !isZoomWebSdkActive && resolvedType !== 'youtube' && resolvedType !== 'gumlet') {
    try {
      const response = await fetch('/api/zoom/resolve-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: activeStreamUrl,
          passcode: currentCampaign.zoomPasscode
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          resolvedUrl = data.url;
          const resolvedYtId = getYoutubeVideoId(resolvedUrl);
          if (resolvedYtId) {
            ytId = resolvedYtId;
            resolvedType = 'youtube';
          } else {
            resolvedType = data.type; // 'video' or 'iframe'
          }
          console.log(`[Player Setup] Resolved stream successfully! Type: ${resolvedType}, Url: ${resolvedUrl}`);
        }
      }
    } catch (e) {
      console.error("[Player Setup] Error contacting resolver backend, fallback to default:", e);
    }
  }

  // Handle Zoom Web SDK
  if (isZoomWebSdkActive) {
    vid.classList.add('hidden');
    document.getElementById('zoom-player-container').classList.remove('hidden');
    
    const finalZoomUrl = getZoomEmbedUrl(currentCampaign, currentLead?.name, currentLead?.email);
    document.getElementById('zoom-iframe').src = finalZoomUrl;
    return;
  }

  // Hide all containers first to be completely clean
  document.getElementById('zoom-player-container').classList.add('hidden');
  document.getElementById('youtube-player-container').classList.add('hidden');
  const gumletContainer = document.getElementById('gumlet-player-container');
  if (gumletContainer) gumletContainer.classList.add('hidden');

  if (window._hlsInstance) {
    try {
      window._hlsInstance.destroy();
    } catch (e) {
      console.warn("[Hls] Error destroying instance:", e);
    }
    window._hlsInstance = null;
  }

  if (resolvedType === 'gumlet') {
    vid.classList.add('hidden');
    if (gumletContainer) {
      gumletContainer.classList.remove('hidden');
      // Keep it pointer-events-none so users can't pause the video by clicking it
    }

    // Initialize Gumlet player asynchronously - no await blocking!
    initGumletPlayer(gumletId, startOffsetSec).then((player) => {
      console.log("[Gumlet Player] Loaded and ready.");
      // If the user already clicked play, trigger full unmuted playback instantly
      if (player && window.clickedToPlay) {
        try {
          player.unMute();
          player.setVolume(100);
          if (startOffsetSec > 0 && !window._gumletHasSeeked) {
            player.seekTo(startOffsetSec, true);
            window._gumletHasSeeked = true;
          }
          player.playVideo();
        } catch (e) {
          console.warn("[Gumlet Player] Async autoplay activation failed:", e);
        }
      }
    });

  } else if (resolvedType === 'youtube') {
    vid.classList.add('hidden');
    document.getElementById('youtube-player-container').classList.remove('hidden');

    ensureYoutubeApiLoaded();

    const handleStateChange = (event) => {
      if (event.data === YT.PlayerState.ENDED) {
        if (typeof window.handleVideoEnd === 'function') {
          window.handleVideoEnd();
        }
      }
    };

    // Initialize YouTube player asynchronously - no await blocking!
    initYoutubePlayer(ytId, startOffsetSec, handleStateChange).then((player) => {
      console.log("[YouTube Player] Loaded and ready.");
      // If the user already clicked play, trigger full unmuted playback instantly
      if (window.clickedToPlay) {
        try {
          player.unMute();
          player.setVolume(100);
          if (startOffsetSec > 0 && !window._ytHasSeeked) {
            player.seekTo(startOffsetSec, true);
            window._ytHasSeeked = true;
          }
          player.playVideo();
        } catch (e) {
          console.warn("[YouTube API] Async autoplay activation failed:", e);
        }
      }
    });

  } else if (resolvedType === 'iframe') {
    vid.classList.add('hidden');
    document.getElementById('zoom-player-container').classList.remove('hidden');
    document.getElementById('zoom-iframe').src = resolvedUrl;

  } else {
    // NATIVE VIDEO PLAYER FOR RAW VIDEO FILE (Dropbox, custom mp4 links) or HLS stream
    vid.classList.remove('hidden');
    if (resolvedUrl.includes('.m3u8') || resolvedUrl.includes('hls')) {
      if (window.Hls && Hls.isSupported()) {
        console.log("[Hls.js] Initializing Hls stream playing...");
        if (window._hlsInstance) {
          window._hlsInstance.destroy();
        }
        const hls = new Hls();
        hls.loadSource(resolvedUrl);
        hls.attachMedia(vid);
        window._hlsInstance = hls;
      } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("[Hls] Playing native apple mpegurl stream...");
        vid.src = resolvedUrl;
      } else {
        vid.src = resolvedUrl;
      }
    } else {
      if (window._hlsInstance) {
        window._hlsInstance.destroy();
        window._hlsInstance = null;
      }
      vid.src = resolvedUrl;
    }
    vid.load();

    if (startOffsetSec > 0) {
      const seekOnLoad = () => {
        if (vid.duration && !isNaN(vid.duration)) {
          currentCampaign.videoDuration = Math.ceil(vid.duration);
          console.log("[Player Setup] Dynamically updated campaign duration to matches video file:", currentCampaign.videoDuration);
        }
        if (startOffsetSec < vid.duration) {
          try {
            vid.currentTime = startOffsetSec;
          } catch (e) {
            console.warn("[Player Setup] Ignored eager seek:", e);
          }
        } else {
          if (typeof window.handleVideoEnd === 'function') {
            window.handleVideoEnd();
          }
        }
        vid.removeEventListener('loadedmetadata', seekOnLoad);
      };
      vid.addEventListener('loadedmetadata', seekOnLoad);
    } else {
      const updateDurationOnLoad = () => {
        if (vid.duration && !isNaN(vid.duration)) {
          currentCampaign.videoDuration = Math.ceil(vid.duration);
          console.log("[Player Setup] Dynamically updated campaign duration from video file metadata:", currentCampaign.videoDuration);
        }
        vid.removeEventListener('loadedmetadata', updateDurationOnLoad);
      };
      vid.addEventListener('loadedmetadata', updateDurationOnLoad);
    }

    // Try muted autoplay immediately to get stream moving in background (safe for mobile/desktop)
    vid.muted = true;
    vid.play().then(() => {
      console.log("[Native Autoplay] Muted background playback active!");
      if (startOffsetSec > 0) {
        if (startOffsetSec < vid.duration) {
          vid.currentTime = startOffsetSec;
        } else {
          vid.pause();
          if (typeof window.handleVideoEnd === 'function') {
            window.handleVideoEnd();
          }
        }
      }
      
      // If user clicked play while loading, unmute immediately
      if (window.clickedToPlay) {
        vid.muted = false;
        vid.volume = 1.0;
      }
    }).catch(err => {
      console.warn("[Native Autoplay] blocked:", err);
    });
    
    vid.addEventListener('ended', () => {
      if (typeof window.handleVideoEnd === 'function') {
        window.handleVideoEnd();
      }
    });
  }
}

// Add visibility change listener to handle mobile pause on background
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && window.clickedToPlay) {
    const vid = document.getElementById('main-video-player');
    const resolvedType = window._resolvedPlayerType || 
      (window.activeStreamUrl ? 
        (getGumletVideoId(window.activeStreamUrl) ? 'gumlet' : 
         (getYoutubeVideoId(window.activeStreamUrl) ? 'youtube' : 'video')
        ) : 'video'
      );
    const isZoomWebSdkActive = currentCampaign && currentCampaign.zoomEnabled && (currentCampaign.zoomLiveMode === 'web-sdk') && (currentCampaign.zoomEmbedUrl || currentCampaign.zoomMeetingId);

    if (isZoomWebSdkActive) return; // Zoom handles itself
    
    // Calculate the true live time they should be at right now
    let currentLiveOffset = 0;
    const rAt = localStorage.getItem('webinar_registered_at');
    if (rAt && currentCampaign && !currentCampaign.isRealYoutubeLive) {
      const rTime = parseInt(rAt, 10);
      const cDur = currentCampaign.countdownDuration || 15;
      const eMs = Date.now() - (rTime + (cDur * 1000));
      if (eMs > 0) {
        currentLiveOffset = Math.floor(eMs / 1000);
      }
    }

    /* 
     ================================================================================
     ADJUSTMENT POINT: VISIBILITY END CHECK
     We have removed the automatic tab-return duration checking calling handleVideoEnd()
     to prevent users from getting forcefully turned offline.
     ================================================================================
    */
    
    console.log("[Player] Visibility returned. Resuming play if paused and catching up to true live offset:", currentLiveOffset);
    
    // Briefly show blocker when returning to tab to hide YouTube controls
    const ytBlocker = document.getElementById('youtube-ui-blocker');
    if (ytBlocker && resolvedType === 'youtube') {
      ytBlocker.classList.remove('opacity-0');
      ytBlocker.classList.add('opacity-100');
    }
    
    // For Gumlet
    if (resolvedType === 'gumlet') {
      if (window._gumletPlayer && !window._gumletIsPlaying) {
        try {
          if (currentLiveOffset > 0) {
            window._gumletPlayer.seekTo(currentLiveOffset, true);
          }
          
          let playPromise = window._gumletPlayer.playVideo();
          if (playPromise) {
            playPromise.catch(() => {
              const clickOverlay = document.getElementById('video-click-overlay');
              if (clickOverlay) {
                clickOverlay.classList.remove('hidden', 'opacity-0');
                const interactiveContent = document.getElementById('overlay-interactive-content');
                const bufferingContent = document.getElementById('overlay-buffering-content');
                if (interactiveContent) interactiveContent.classList.remove('hidden');
                if (bufferingContent) bufferingContent.classList.add('hidden');
                const btn = document.getElementById('unmute-cta-btn');
                if (btn) btn.innerHTML = `<i data-lucide="play" class="h-4 w-4 stroke-[3]"></i><span>RESUME BROADCAST</span>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
              }
            });
          }
          
          if (window.clickedToPlay) {
            window._gumletPlayer.unMute();
            window._gumletPlayer.setVolume(100);
          }
        } catch (e) {
          console.warn("[Gumlet visibility resume failed]", e);
        }
      }
    }
    // For Native video
    else if (resolvedType === 'video') {
      if (vid && vid.paused) {
        if (currentLiveOffset > 0 && currentLiveOffset < vid.duration) {
            vid.currentTime = currentLiveOffset;
        }
        vid.play().catch(() => {
          // Play failed, show click overlay again to resume
          const clickOverlay = document.getElementById('video-click-overlay');
          if (clickOverlay) {
            clickOverlay.classList.remove('hidden', 'opacity-0');
            const interactiveContent = document.getElementById('overlay-interactive-content');
            const bufferingContent = document.getElementById('overlay-buffering-content');
            if (interactiveContent) interactiveContent.classList.remove('hidden');
            if (bufferingContent) bufferingContent.classList.add('hidden');
            const btn = document.getElementById('unmute-cta-btn');
            if (btn) btn.innerHTML = `<i data-lucide="play" class="h-4 w-4 stroke-[3]"></i><span>RESUME BROADCAST</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
          }
        });
      }
    } 
    // For YouTube
    else if (resolvedType === 'youtube' && window._ytPlayer) {
      if (currentYtState !== 1 && currentYtState !== 3) {
        try {
          if (currentLiveOffset > 0) {
             window._ytPlayer.seekTo(currentLiveOffset, true);
          }
          window._ytPlayer.playVideo();
        } catch(e) {
          console.warn(e);
        }
        if (blockerTimeout) clearTimeout(blockerTimeout);
        
        /*
          ================================================================================
         ADJUSTMENT POINT: VISIBILITY RETURN BLOCKER FADE-OUT DELAY (DEFAULT: 4000ms)
         When a user returns to the tab, we briefly shield the screen to cover the 
         YouTube loading controls. Change this value to adjust the duration of the shield.
         ================================================================================
        */
        const returnFadeDelayMs = 4000;
      blockerTimeout = setTimeout(() => {
        if (currentYtState !== 1 && currentYtState !== 3) {
          // Play failed or is paused! Show beautiful resume overlay
          const clickOverlay = document.getElementById('video-click-overlay');
          if (clickOverlay) {
            clickOverlay.classList.remove('hidden', 'opacity-0');
            const interactiveContent = document.getElementById('overlay-interactive-content');
            const bufferingContent = document.getElementById('overlay-buffering-content');
            if (interactiveContent) interactiveContent.classList.remove('hidden');
            if (bufferingContent) bufferingContent.classList.add('hidden');
            const btn = document.getElementById('unmute-cta-btn');
            if (btn) btn.innerHTML = `<i data-lucide="play" class="h-4 w-4 stroke-[3]"></i><span>RESUME BROADCAST</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
          }
          if (ytBlocker) {
            ytBlocker.classList.remove('opacity-0');
            ytBlocker.classList.add('opacity-100');
          }
        } else {
          // Playing successfully! Fade out the blocker
          if (ytBlocker) {
            ytBlocker.classList.remove('opacity-100');
            ytBlocker.classList.add('opacity-0');
          }
        }
      }, returnFadeDelayMs);

      } else {
        if (ytBlocker) {
          ytBlocker.classList.remove('opacity-100');
          ytBlocker.classList.add('opacity-0');
        }
      }    }
  }
});
