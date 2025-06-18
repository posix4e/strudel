import { initStrudel, initAudioOnFirstClick, evaluate, hush, samples } from '@strudel/web';

// Status display helper
const setStatus = (message) => {
  document.getElementById('status').textContent = message;
};

// WAV file encoding
function encodeWAV(buffer, sampleRate) {
  const length = buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, sample * 0x7FFF, true);
    offset += 2;
  }
  
  return arrayBuffer;
}

// Offline rendering function
async function renderOffline(patternCode, duration, sampleRate = 44100) {
  setStatus('Initializing offline rendering...');
  
  // Create offline audio context
  const offlineContext = new OfflineAudioContext(1, duration * sampleRate, sampleRate);
  
  // We need to patch the audio system to use our offline context
  // This is a hack - ideally Strudel would support this natively
  const originalGetContext = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function() { return offlineContext; };
  window.webkitAudioContext = function() { return offlineContext; };
  
  try {
    // Initialize Strudel with offline context
    await initStrudel({
      prebake: () => samples('github:tidalcycles/dirt-samples'),
      getTime: () => offlineContext.currentTime,
    });
    
    setStatus('Loading samples and preparing pattern...');
    
    // Evaluate the pattern
    const pattern = await evaluate(patternCode);
    
    // Query all events in the time range
    const events = pattern.queryArc(0, duration);
    
    setStatus(`Scheduling ${events.length} events...`);
    
    // Schedule all events
    // Note: This is simplified - a full implementation would need to handle
    // all the audio routing and effects that Strudel normally does
    events.forEach(event => {
      const startTime = event.whole.begin;
      const endTime = event.whole.end;
      
      // Create a simple oscillator as placeholder
      // In a real implementation, this would trigger superdough
      const osc = offlineContext.createOscillator();
      const gain = offlineContext.createGain();
      
      osc.connect(gain);
      gain.connect(offlineContext.destination);
      
      osc.frequency.value = 440; // placeholder frequency
      gain.gain.value = 0.1;
      
      osc.start(startTime);
      osc.stop(endTime);
    });
    
    setStatus('Rendering audio...');
    
    // Start offline rendering
    const renderedBuffer = await offlineContext.startRendering();
    
    setStatus('Encoding WAV file...');
    
    // Convert to WAV
    const wavArrayBuffer = encodeWAV(renderedBuffer.getChannelData(0), sampleRate);
    
    // Create download link
    const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strudel-export.wav';
    a.click();
    
    setStatus('Export complete!');
    
    // Cleanup
    URL.revokeObjectURL(url);
    
  } finally {
    // Restore original AudioContext
    window.AudioContext = originalGetContext;
    window.webkitAudioContext = originalGetContext;
  }
}

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Strudel for preview
  await initStrudel({
    prebake: () => samples('github:tidalcycles/dirt-samples'),
  });
  
  await initAudioOnFirstClick();
  
  // Preview button
  document.getElementById('preview').addEventListener('click', () => {
    const code = document.getElementById('pattern-code').value;
    evaluate(code);
    setStatus('Playing pattern...');
  });
  
  // Stop button
  document.getElementById('stop').addEventListener('click', () => {
    hush();
    setStatus('Stopped');
  });
  
  // Export button
  document.getElementById('export').addEventListener('click', async () => {
    const code = document.getElementById('pattern-code').value;
    const duration = parseFloat(document.getElementById('duration').value);
    const sampleRate = parseInt(document.getElementById('sampleRate').value);
    
    try {
      // Stop any playing patterns first
      hush();
      
      // Note: This is a simplified proof-of-concept
      // A full implementation would require deeper integration with Strudel's audio engine
      setStatus('Export functionality is a proof-of-concept. See console for details.');
      
      console.log('Full offline rendering would require:');
      console.log('1. Modifying superdough to support OfflineAudioContext');
      console.log('2. Pre-calculating all pattern events');
      console.log('3. Rendering samples and synths offline');
      console.log('4. Applying effects in the offline context');
      console.log('Pattern:', code);
      console.log('Duration:', duration, 'seconds');
      console.log('Sample rate:', sampleRate, 'Hz');
      
      // For now, just demonstrate the pattern query
      const pattern = await evaluate(code);
      const events = pattern.queryArc(0, duration);
      console.log('Pattern would generate', events.length, 'events');
      
    } catch (error) {
      setStatus('Export error: ' + error.message);
      console.error(error);
    }
  });
  
  setStatus('Ready');
});