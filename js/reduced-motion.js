export const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.toggle('reduced-motion', prefersReducedMotion);
