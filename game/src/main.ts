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
