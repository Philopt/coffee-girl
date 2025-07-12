import { GameState } from './state.js';

export function stopSong() {
  if (Array.isArray(GameState.musicLoops)) {
    GameState.musicLoops.forEach(s => {
      if (s && s.stop) s.stop();
    });
  }
  GameState.musicLoops = [];
  GameState.drumLoop = null;
  if (GameState.songInstance) {
    if (GameState.songInstance.stop) {
      GameState.songInstance.stop();
    } else if (GameState.songInstance.intro && GameState.songInstance.intro.stop) {
      GameState.songInstance.intro.stop();
    }
  }
  GameState.songInstance = null;
  GameState.currentSong = null;
}

export function playSong(scene, key) {
  if (!scene || !scene.sound) return;
  stopSong();
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
  } else if (key === 'lady_falcon_theme') {
    intro = scene.sound.add('falcon_intro');
    const bass = scene.sound.add('falcon_bass', { loop: true });
    const drums = scene.sound.add('falcon_drums', { loop: true, volume: 0.1 });
    const synth = scene.sound.add('falcon_synth', { loop: true });
    GameState.songInstance = intro;
    GameState.musicLoops = [bass, drums, synth];
    GameState.drumLoop = drums;
    intro.once('complete', () => {
      if (GameState.songInstance === intro) {
        GameState.songInstance = null;
        bass.play();
        drums.play();
        synth.play();
      }
    });
    intro.play();
  } else {
    GameState.songInstance = null;
  }
}

export function setDrumVolume(vol) {
  if (GameState.drumLoop && GameState.drumLoop.setVolume) {
    GameState.drumLoop.setVolume(vol);
  }
}
