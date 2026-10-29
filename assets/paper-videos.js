(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.createElement('dialog');
  dialog.className = 'paper-video-dialog';
  dialog.setAttribute('aria-labelledby', 'paper-video-title');
  dialog.innerHTML = `<header><h2 id="paper-video-title"></h2><button type="button" aria-label="Close enlarged video" autofocus>Close ×</button></header><video controls muted loop playsinline preload="none"></video>`;
  document.body.append(dialog);
  const enlargedVideo = dialog.querySelector('video');
  const dialogTitle = dialog.querySelector('h2');
  let activePreview = null;
  let startTime = 0;

  const previews = [...document.querySelectorAll('[data-video-preview]')].map(container => {
    const video = container.querySelector('video');
    const button = container.querySelector('.publication-video-toggle');
    const expand = document.createElement('button');
    expand.className = 'publication-video-expand';
    expand.type = 'button';
    expand.innerHTML = 'Enlarge <span aria-hidden="true">↗</span>';
    expand.setAttribute('aria-label', `Enlarge ${video.dataset.title} demonstration`);
    expand.setAttribute('aria-haspopup', 'dialog');
    container.append(expand);
    const state = { container, video, button, visible: false, choice: null, loaded: false };
    video.muted = true;
    video.controls = false;
    button.hidden = false;

    const updateButton = () => {
      const action = video.paused ? 'Play' : 'Pause';
      button.setAttribute('aria-label', `${action} ${video.dataset.title} demonstration`);
      button.title = `${action} video`;
      button.querySelector('span').textContent = video.paused ? '▶' : 'Ⅱ';
    };
    const load = () => {
      if (state.loaded) return;
      state.loaded = true;
      video.preload = 'metadata';
      video.load();
    };
    const play = () => {
      load();
      video.play().catch(updateButton);
    };
    state.sync = () => {
      if (state.visible) load();
      const wantsPlayback = state.choice === 'play' || (state.choice === null && !reducedMotion.matches);
      if (state.visible && !document.hidden && !dialog.open && wantsPlayback) play();
      else video.pause();
    };
    expand.addEventListener('click', () => {
      activePreview = state;
      startTime = video.currentTime;
      dialogTitle.textContent = video.dataset.title;
      enlargedVideo.setAttribute('aria-label', video.getAttribute('aria-label'));
      enlargedVideo.muted = true;
      enlargedVideo.src = video.currentSrc || video.src;
      dialog.showModal();
      document.documentElement.classList.add('paper-video-open');
      syncAll();
      // An explicit request to enlarge starts playback, including when the
      // visitor prefers reduced motion. Native controls allow frame inspection.
      enlargedVideo.play().catch(() => {});
    });
    button.addEventListener('click', () => {
      if (video.paused) { state.choice = 'play'; play(); }
      else { state.choice = 'pause'; video.pause(); }
    });
    video.addEventListener('play', updateButton);
    video.addEventListener('pause', updateButton);
    video.addEventListener('error', () => {
      button.hidden = true;
      container.querySelector('.publication-video-error').hidden = false;
    });
    return state;
  });

  // Start only visible previews and suspend off-screen media, including when
  // switching tabs. A visitor's pause choice survives scrolling away and back.
  const states = new Map(previews.map(state => [state.container, state]));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      state.visible = entry.isIntersecting && entry.intersectionRatio >= .2;
      state.sync();
    });
  }, { threshold: [0, .2] });
  previews.forEach(state => observer.observe(state.container));
  const syncAll = () => previews.forEach(state => state.sync());
  enlargedVideo.addEventListener('loadedmetadata', () => {
    if (activePreview && Number.isFinite(enlargedVideo.duration)) {
      enlargedVideo.currentTime = Math.min(startTime, enlargedVideo.duration);
    }
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  let pointerStartedOnBackdrop = false;
  dialog.addEventListener('pointerdown', event => {
    pointerStartedOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', event => {
    if (pointerStartedOnBackdrop && event.target === dialog) dialog.close();
    pointerStartedOnBackdrop = false;
  });
  dialog.addEventListener('close', () => {
    if (activePreview && enlargedVideo.readyState >= 1 && activePreview.video.readyState >= 1) {
      activePreview.video.currentTime = enlargedVideo.currentTime;
    }
    enlargedVideo.pause();
    enlargedVideo.removeAttribute('src');
    enlargedVideo.load();
    activePreview = null;
    document.documentElement.classList.remove('paper-video-open');
    syncAll();
  });
  reducedMotion.addEventListener('change', syncAll);
  document.addEventListener('visibilitychange', syncAll);
})();
