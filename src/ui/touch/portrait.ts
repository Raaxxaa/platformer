// Portrait on a phone (07 §8.6): the game pauses and shows "Turn your phone sideways" with a rotating-phone drawing.
import type Phaser from 'phaser';
import { isPortrait, isTouchDevice } from '../../game/zoom.ts';
import { touchModel } from './touchInput.ts';

export function installPortraitGuard(game: Phaser.Game): void {
  const el = document.createElement('div');
  el.id = 'portrait'; el.className = 'portrait';
  el.innerHTML = '<div class="portrait-phone"></div><div class="portrait-text">Turn your phone sideways</div>';
  document.body.append(el);
  let asleep = false;
  const apply = () => {
    const portrait = isTouchDevice() && isPortrait(window.innerWidth, window.innerHeight);
    el.style.display = portrait ? 'flex' : 'none';
    if (portrait && !asleep) { asleep = true; touchModel.releaseAll(); game.loop.sleep(); game.sound.pauseAll(); }
    else if (!portrait && asleep) { asleep = false; game.loop.wake(); game.sound.resumeAll(); }
    window.__portrait = portrait;
  };
  window.addEventListener('resize', apply); window.addEventListener('orientationchange', apply);
  apply();
}
declare global { interface Window { __portrait?: boolean } }
