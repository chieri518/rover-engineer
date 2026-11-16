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
import { worldFromQuery } from './worlds';
import { demoCampaign, isDemoVariant } from './ui/dashboardDemo';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('missing #app');

loadGameData('mars'); // check every world's data at startup, not when the campaign reaches it
loadGameData('titan');
const game = new Game(loadGameData, root, screens);
// Debug start: ?world=mars or ?world=titan begins a throwaway campaign on that world (not saved).
// ?dashboard=demo, demo-lost or demo-old opens the Campaign complete dashboard on a fake finished campaign (not saved).
const debugWorld = worldFromQuery(location.search);
const dashboardDemo = new URLSearchParams(location.search).get('dashboard');
if (isDemoVariant(dashboardDemo)) game.debugComplete(demoCampaign(loadGameData, dashboardDemo));
else if (debugWorld && debugWorld !== 'moon') game.debugStart(debugWorld);
else game.go('title');

// Development hook for testing the screen flow (not in production builds).
if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = game;
