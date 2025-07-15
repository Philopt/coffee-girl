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

export function playSong(scene, key, onLoopStart = null) {
  if (!scene || !scene.sound) return;

  scene.sound.volume = GameState.volume;

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
        if (typeof onLoopStart === 'function') onLoopStart();
        else if (typeof GameState.onSongLoopStart === 'function') GameState.onSongLoopStart();
        GameState.onSongLoopStart = null;
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
        if (typeof onLoopStart === 'function') onLoopStart();
        else if (typeof GameState.onSongLoopStart === 'function') GameState.onSongLoopStart();
        GameState.onSongLoopStart = null;
      }
    });
    intro.play();
  } else if (key === 'customer_revolt') {
    intro = scene.sound.add('revolt_intro');
    const bass = scene.sound.add('revolt_bass', { loop: true, volume: 0.6 });
    const drums = scene.sound.add('revolt_drums', { loop: true, volume: 0.6 });
    const synth = scene.sound.add('revolt_synth', { loop: true, volume: 0.6 });
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
  } else if (key === 'muse_theme') {
    intro = scene.sound.add('muse_intro');
    const drums = scene.sound.add('muse_drum', { loop: true, volume: 0.6 });
    const synth = scene.sound.add('muse_synth', { loop: true, volume: 0.6 });
    const vocals = scene.sound.add('muse_vocals', { loop: true, volume: 0.6 });
    GameState.songInstance = intro;
    GameState.musicLoops = [drums, synth, vocals];
    GameState.drumLoop = drums;
    intro.once('complete', () => {
      if (GameState.songInstance === intro) {
        GameState.songInstance = null;
        drums.play();
        synth.play();
        vocals.play();
      }
    });
    intro.play();
  } else {
    GameState.songInstance = null;
    if (typeof onLoopStart === 'function') onLoopStart();
    else if (typeof GameState.onSongLoopStart === 'function') GameState.onSongLoopStart();
    GameState.onSongLoopStart = null;
  }
}

export function setDrumVolume(vol) {
  if (GameState.drumLoop && GameState.drumLoop.setVolume) {
    GameState.drumLoop.setVolume(vol);
  }
}

export function fadeDrums(scene, vol, duration = 600) {
  if (!scene || !GameState.drumLoop || !scene.tweens) return;
  scene.tweens.add({
    targets: GameState.drumLoop,
    volume: vol,
    duration,
    ease: 'Linear',
  });
}

export function updateRevoltMusicVolume() {
  if (GameState.currentSong !== 'customer_revolt') return;
  const [bass, drums, synth] = GameState.musicLoops || [];
  const money = GameState.money || 0;
  const love = GameState.love || 0;
  if (drums && drums.setVolume) {
    const dVol = Math.min(1, Math.max(0, money / 10)) * 0.6;
    drums.setVolume(dVol);
  }
  if (bass && bass.setVolume) {
    const bVol = Math.min(1, Math.max(0, love / 3)) * 0.6;
    bass.setVolume(bVol);
  }
  if (synth && synth.setVolume) {
    const mFac = Math.min(1, Math.max(0, (money - 10) / 10));
    const lFac = Math.min(1, Math.max(0, (love - 10) / 10));
    const sVol = mFac * lFac * 0.6;
    synth.setVolume(sVol);
  }
}

export function updateMuseMusicVolume() {
  if (GameState.currentSong !== 'muse_theme') return;
  const [drums, synth, vocals] = GameState.musicLoops || [];
  const money = GameState.money || 0;
  const love = GameState.love || 0;
  if (drums && drums.setVolume) {
    const dVol = Math.min(1, Math.max(0, money / 10)) * 0.6;
    drums.setVolume(dVol);
  }
  if (synth && synth.setVolume) {
    const sVol = Math.min(1, Math.max(0, love / 3)) * 0.6;
    synth.setVolume(sVol);
  }
  if (vocals && vocals.setVolume) {
    const mFac = Math.min(1, Math.max(0, (money - 10) / 10));
    const lFac = Math.min(1, Math.max(0, (love - 10) / 10));
    const vVol = mFac * lFac * 0.6;
    vocals.setVolume(vVol);
  }
}
