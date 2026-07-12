import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const fontsReady = Promise.all([
  loadFont({ family: 'Josefin Sans', url: staticFile('fonts/JosefinSans.ttf') }),
  loadFont({ family: 'Nunito Sans', url: staticFile('fonts/NunitoSans.ttf') }),
]);
