import { staticFile } from 'remotion';

// Fonts are registered via a plain CSS @font-face rule, NOT @remotion/fonts'
// loadFont(): in the headless Chromium used for rendering, loadFont()'s
// FontFace.load() promise never settles (the file *fetches* fine — 200 in
// ~15ms — but load() hangs), so its delayRender never clears and every render
// times out. A CSS face applies the font on paint instead, and Remotion already
// waits for `document.fonts.ready` before capturing each frame
// (@remotion/renderer seek-to-frame), so no manual delayRender gate is needed —
// adding one only reintroduces the hang, because a virtual-clock setTimeout
// escape never fires during frame rendering.
//
// Both files are variable fonts; the wght range is declared so every weight the
// components use renders true (Josefin 600; Nunito 400/600/700), not faux-bold.
const FACES = [
  { family: 'Josefin Sans', file: 'fonts/JosefinSans.ttf', range: '100 700' },
  { family: 'Nunito Sans', file: 'fonts/NunitoSans.ttf', range: '200 1000' },
];

if (typeof document !== 'undefined') {
  const css = FACES.map(
    (f) => `@font-face{font-family:'${f.family}';`
      + `src:url('${staticFile(f.file)}') format('truetype');`
      + `font-weight:${f.range};font-style:normal;font-display:block;}`,
  ).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
