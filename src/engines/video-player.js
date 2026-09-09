import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Video Player Engine
 * Mounts a <video> element behind the main canvas to play MP4/WebM files natively,
 * using the asset:// protocol for zero-copy streaming from disk.
 */
export default function createVideoPlayer(canvas, options) {
  let isRunning = false;
  let videoEl = null;

  const container = canvas.parentNode;

  function loadVideo(path) {
    if (!path) return;
    try {
      if (videoEl) {
        // Explicitly tear down previous hardware video decoding pipeline before allocating new one
        try {
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch (e) {}

        // Use Tauri asset protocol if it's an absolute local path
        const normalized = path.replace(/\\/g, '/');
        videoEl.src = (normalized.startsWith('http') || normalized.startsWith('data:') || normalized.startsWith('blob:')) 
          ? normalized 
          : convertFileSrc(normalized);
          
        videoEl.onerror = async (err) => {
          console.warn('[AuraOS] convertFileSrc video load failed, attempting fs blob fallback:', path, err);
          try {
            const { readFile } = await import('@tauri-apps/plugin-fs');
            const bytes = await readFile(path);
            const mime = path.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
            const blob = new Blob([bytes], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            if (videoEl) {
              videoEl.src = blobUrl;
              videoEl.load();
              if (isRunning) {
                videoEl.play().catch(e => console.error("AuraOS: Auto-play blocked on fallback", e));
              }
            }
          } catch (fsErr) {
            console.error('[AuraOS] All video load strategies failed for:', path, fsErr);
          }
        };

        videoEl.load();
        if (isRunning) {
          videoEl.play().catch(e => console.error("AuraOS: Auto-play blocked", e));
        }
      }
    } catch (err) {
      console.error("AuraOS: Failed to load video", err);
    }
  }

  function init() {
    videoEl = document.createElement('video');
    videoEl.loop = true;
    videoEl.autoplay = false;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.preload = options.preview ? 'metadata' : 'auto';
    
    // Always mute in preview mode
    if (options.preview) {
      videoEl.muted = true;
      videoEl.volume = 0;
      videoEl.setAttribute('muted', '');
      videoEl.onloadedmetadata = () => {
        if (videoEl.currentTime === 0) {
          try { videoEl.currentTime = 0.05; } catch (e) {}
        }
      };
    } else {
      videoEl.muted = options.muted ?? false;
      videoEl.volume = Math.max(0, Math.min(1, (options.volume ?? 50) / 100));
    }
    
    // Style it to cover the container (zIndex 0 so it stays behind overlays)
    videoEl.style.position = 'absolute';
    videoEl.style.inset = '0';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.zIndex = '0';
    if (options.opacity !== undefined) {
      videoEl.style.opacity = options.opacity;
    }
    if (options.brightness !== undefined) {
      videoEl.style.filter = `brightness(${options.brightness})`;
    }
    
    container.insertBefore(videoEl, canvas);
    
    // Hide canvas since we use video
    canvas.style.display = 'none';

    if (options.videoPath) {
      loadVideo(options.videoPath);
    }

    if (options.speedMultiplier) {
      videoEl.playbackRate = options.speedMultiplier;
    }
  }

  init();

  return {
    start() {
      isRunning = true;
      if (videoEl && videoEl.src) {
        const p = videoEl.play();
        if (p !== undefined) {
          p.catch(e => {
            // If autoplay was blocked, seek slightly to ensure frame is shown
            if (videoEl.currentTime === 0) {
              try { videoEl.currentTime = 0.05; } catch (err) {}
            }
          });
        }
      }
    },
    stop() {
      isRunning = false;
      if (videoEl) {
        try {
          videoEl.pause();
          videoEl.muted = true;
          videoEl.volume = 0;
          videoEl.currentTime = 0;
          videoEl.src = '';
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch (e) {}
        videoEl.remove();
        videoEl = null;
      }
      if (canvas) canvas.style.display = ''; // restore canvas visibility
    },
    updateOptions(newOpts) {
      if (newOpts.videoPath !== options.videoPath) {
        loadVideo(newOpts.videoPath);
      }
      if (newOpts.speedMultiplier !== undefined && videoEl) {
        videoEl.playbackRate = newOpts.speedMultiplier;
      }
      if (newOpts.opacity !== undefined && videoEl) {
        videoEl.style.opacity = newOpts.opacity;
      }
      if (newOpts.brightness !== undefined && videoEl) {
        videoEl.style.filter = `brightness(${newOpts.brightness})`;
      }
      if (newOpts.muted !== undefined && videoEl && !options.preview) {
        videoEl.muted = newOpts.muted;
      }
      if (newOpts.volume !== undefined && videoEl && !options.preview) {
        videoEl.volume = Math.max(0, Math.min(1, newOpts.volume / 100));
      }
      if (newOpts.paused !== undefined && videoEl) {
        if (newOpts.paused) {
          videoEl.pause();
        } else {
          videoEl.play().catch(e => {});
        }
      }
      options = { ...options, ...newOpts };
    },
    pause() {
      if (videoEl) videoEl.pause();
    },
    resume() {
      if (videoEl && isRunning) videoEl.play().catch(e => {});
    }
  };
}
