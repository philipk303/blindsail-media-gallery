document.documentElement.classList.toggle(
  'reduced-motion',
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
);
