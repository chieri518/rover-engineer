// The intro film (game-design.md §11, Intro video): after Start new campaign, before the Welcome to REL
// cards. A full-screen, wordless 39 s video with its own score; it ends on black, then the cards open.
// Skip (or Esc) jumps to the cards; if the video cannot load or play, the cards open straight away.
// The film is rendered offline by game/cinematic/ and shipped as public/intro/rover-engineer-intro.mp4.
import type { Screen } from '../flow/flow';
import { FILM } from '../audio/mix';
import { filmVolume } from '../audio/tune';
import { el } from './dom';

const FILM_URL = `${import.meta.env.BASE_URL}intro/rover-engineer-intro.mp4`;
/** A beat on black after the film's last frame, and the fade on Skip (ms; matches .film-fade in style.css). */
const HOLD_MS = 500;
const FADE_MS = 350;

export const filmScreen: Screen = (game, root) => {
  const t = game.data.text.intro;
  let done = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const video = document.createElement('video');
  video.className = 'film-video';
  video.src = FILM_URL;
  video.preload = 'auto';
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute('aria-label', t.filmLabel);

  const applySound = () => {
    const v = filmVolume(game.settings, FILM);
    video.muted = v === 0;
    video.volume = v;
  };

  const toCards = (delay: number) => {
    if (done) return;
    done = true;
    video.pause();
    timer = setTimeout(() => game.go('intro'), delay);
  };
  const skip = () => {
    if (done) return;
    stage.classList.add('film-fade');
    toCards(FADE_MS);
  };

  const skipButton = el('button', { type: 'button', class: 'film-skip', id: 'film-skip', onclick: skip }, t.filmSkip);
  const stage = el('section', { class: 'film', id: 'film' }, video, skipButton);

  video.addEventListener('ended', () => toCards(HOLD_MS));
  video.addEventListener('error', () => toCards(0));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') skip();
  };
  // A hidden tab pauses the film (it is meant to be watched), and it picks up where it was on return.
  const onVisibility = () => {
    if (done) return;
    if (document.hidden) video.pause();
    else void video.play().catch(() => {});
  };
  const stopListening = game.listen({ settings: applySound });

  applySound();
  root.append(stage);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  skipButton.focus();
  // Start new campaign was a click, so the browser lets the film play with sound. If it refuses anyway
  // (autoplay rules, no video support), go straight to the cards rather than leave a black screen.
  void video.play().catch(() => toCards(0));

  return () => {
    done = true;
    if (timer !== null) clearTimeout(timer);
    stopListening();
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    video.pause();
    video.removeAttribute('src');
    video.load(); // release the media resource
  };
};
