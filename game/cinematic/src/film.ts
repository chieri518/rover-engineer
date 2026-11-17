// The film: the acts in order. Each act's index.ts exports its sequences; timing.ts holds its shot lengths.
import { buildFilm } from './timeline';
import { act1 } from './act1/index';
import { act2 } from './act2/index';
import { act3 } from './act3/index';

export const FILM = buildFilm([...act1, ...act2, ...act3]);
