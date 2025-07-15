export function makeAudioMeter(sound) {
  if (!sound || !sound.manager || !sound.manager.context) {
    return () => 0;
  }
  const ctx = sound.manager.context;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  if (sound.source && sound.source.connect) {
    sound.source.connect(analyser);
  } else if (sound.audioBufferSourceNode && sound.audioBufferSourceNode.connect) {
    sound.audioBufferSourceNode.connect(analyser);
  } else if (sound._source && sound._source.connect) {
    sound._source.connect(analyser);
  } else if (sound.sourceNode && sound.sourceNode.connect) {
    sound.sourceNode.connect(analyser);
  } else if (sound.input && sound.input.connect) {
    sound.input.connect(analyser);
  }
  analyser.connect(ctx.destination);
  return () => {
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] - 128;
      sum += Math.abs(v);
    }
    return sum / (bufferLength * 128);
  };
}
