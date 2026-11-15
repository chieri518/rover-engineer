// Self-hosted fonts (no request to Google): only the weights the stylesheet uses.
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './ui/style.css';
import { loadGameData } from './gameData';
import { Game } from './flow/flow';
import { screens } from './ui/screens';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('missing #app');

const game = new Game(loadGameData(), root, screens);
game.go('title');

// Development hook for testing the screen flow (not in production builds).
if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = game;
