(() => {
  const MIN_ZOOM = 0.75;
  const MAX_ZOOM = 2.2;

  const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  const pixelValue = (value) => {
    const matches = String(value || '').match(/-?[0-9.]+px/g);
    return matches ? Number.parseFloat(matches[matches.length - 1]) : null;
  };

  function rememberDimension(element, property) {
    const key = property === 'top' ? 'timelineBaseTop' : 'timelineBaseHeight';
    if (element.dataset[key] !== undefined) return;
    const value = pixelValue(element.style[property]);
    if (!Number.isFinite(value)) return;
    element.dataset[key] = String(value);
    if (property === 'top') {
      element.dataset.timelineTopUsesHeader = String(element.style.top.includes('var(--header-row)'));
    }
  }

  function setDimension(element, property, zoom) {
    const key = property === 'top' ? 'timelineBaseTop' : 'timelineBaseHeight';
    const value = Number(element.dataset[key]);
    if (!Number.isFinite(value)) return;
    const scaled = `${value * zoom}px`;
    if (property === 'top' && element.dataset.timelineTopUsesHeader === 'true') {
      element.style.top = `calc(var(--header-row) + ${scaled})`;
    } else {
      element.style[property] = scaled;
    }
  }

  function prepareGrid(grid) {
    if (grid.dataset.timelineZoomReady === 'true') return;
    grid.dataset.timelineZoomReady = 'true';
    grid.dataset.timelineBaseHeight = String(pixelValue(grid.style.getPropertyValue('--timeline-height')) || 0);
    grid.dataset.timelineBasePxPerMinute = grid.dataset.pxPerMinute || '';
    grid.querySelectorAll('[style*="top"], [style*="height"]').forEach((element) => {
      rememberDimension(element, 'top');
      rememberDimension(element, 'height');
    });
  }

  function zoomFor(grid) {
    const zoom = Number(grid.dataset.verticalZoom || 1);
    return Number.isFinite(zoom) ? clampZoom(zoom) : 1;
  }

  function updateSearchWindow(grid, previousZoom, nextZoom) {
    const window = grid.querySelector('[data-opening-search-window]');
    if (!window || previousZoom <= 0) return;
    ['--opening-search-top', '--opening-search-height'].forEach((property) => {
      const current = pixelValue(window.style.getPropertyValue(property));
      if (Number.isFinite(current)) window.style.setProperty(property, `${current * (nextZoom / previousZoom)}px`);
    });
  }

  function setZoom(grid, value) {
    prepareGrid(grid);
    const previousZoom = zoomFor(grid);
    const nextZoom = clampZoom(value);
    grid.dataset.verticalZoom = String(nextZoom);
    const baseHeight = Number(grid.dataset.timelineBaseHeight);
    if (Number.isFinite(baseHeight) && baseHeight > 0) {
      grid.style.setProperty('--timeline-height', `${baseHeight * nextZoom}px`);
    }
    const basePxPerMinute = Number(grid.dataset.timelineBasePxPerMinute);
    if (Number.isFinite(basePxPerMinute) && basePxPerMinute > 0) {
      grid.dataset.pxPerMinute = String(basePxPerMinute * nextZoom);
    }
    grid.querySelectorAll('[data-timeline-base-top]').forEach((element) => setDimension(element, 'top', nextZoom));
    grid.querySelectorAll('[data-timeline-base-height]').forEach((element) => setDimension(element, 'height', nextZoom));
    updateSearchWindow(grid, previousZoom, nextZoom);
    const container = grid.closest('.timeline-scroll, .collision-scroll');
    if (container) {
      container.setAttribute('aria-label', `Schedule timeline at ${Math.round(nextZoom * 100)} percent height. Pinch or hold Ctrl or Command while scrolling to change row height only.`);
    }
  }

  function bindZoom(container, grid) {
    prepareGrid(grid);
    container.style.touchAction = 'pan-x pan-y';
    container.title = 'Pinch here or hold Ctrl/⌘ while scrolling to change the timeline height only.';
    const pointers = new Map();
    let pinchStart = null;
    const distance = () => {
      const [first, second] = Array.from(pointers.values());
      return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
    };
    const release = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStart = null;
    };

    container.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      container.setPointerCapture?.(event.pointerId);
      if (pointers.size === 2) pinchStart = { distance: distance(), zoom: zoomFor(grid) };
    });
    container.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size !== 2 || !pinchStart || pinchStart.distance < 1) return;
      event.preventDefault();
      setZoom(grid, pinchStart.zoom * (distance() / pinchStart.distance));
    });
    container.addEventListener('pointerup', release);
    container.addEventListener('pointercancel', release);
    container.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(grid, zoomFor(grid) * Math.exp(-event.deltaY * 0.002));
    }, { passive: false });
  }

  document.querySelectorAll('.timeline-scroll [data-opening-grid], .collision-scroll .collision-grid').forEach((grid) => {
    const container = grid.closest('.timeline-scroll, .collision-scroll');
    if (container) bindZoom(container, grid);
  });
})();
