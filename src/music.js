import { GameState } from './state.js';

export function stopSong() {
  if (GameState.songInstance && GameState.songInstance.stop) {
    GameState.songInstance.stop();
  }
  GameState.songInstance = null;
  GameState.currentSong = null;
}

export function playSong(scene, key) {
  if (!scene || !scene.sound) return;
  if (GameState.songInstance && GameState.songInstance.stop) {
    GameState.songInstance.stop();
  }
  GameState.currentSong = key;
  let intro;
  let loop;
  if (key === 'fired_end') {
    intro = scene.sound.add('fired_intro');
    loop = scene.sound.add('fired_loop', { loop: true });
    GameState.songInstance = intro;
    intro.once('complete', () => {
      if (GameState.songInstance === intro) {
        GameState.songInstance = loop;
        loop.play();
      }
    });
    intro.play();
  } else {
    GameState.songInstance = null;
  }
}
