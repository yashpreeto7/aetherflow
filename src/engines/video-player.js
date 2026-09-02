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
        // Use Tauri asset protocol if it's an absolute local path
        videoEl.src = path.startsWith('http') || path.startsWith('data:') 
          ? path 
          : convertFileSrc(path);
          
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
    videoEl.autoplay = false; // Never use HTML autoplay to prevent unmanaged playback
    
    // Always mute in preview mode
    if (options.preview) {
      videoEl.muted = true;
      videoEl.volume = 0;
    } else {
      videoEl.muted = options.muted ?? false;
      videoEl.volume = Math.max(0, Math.min(1, (options.volume ?? 50) / 100));
    }
    
    // Style it to cover the container (just like the canvas does)
    videoEl.style.position = 'absolute';
    videoEl.style.inset = '0';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.zIndex = '-2'; // behind canvas (-1)
    
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
        videoEl.play().catch(e => console.log("AuraOS: Play prevented", e));
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
      options = newOpts;
    },
    pause() {
      if (videoEl) videoEl.pause();
    },
    resume() {
      if (videoEl && isRunning) videoEl.play().catch(e => {});
    }
  };
}
