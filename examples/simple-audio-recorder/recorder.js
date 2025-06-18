import { initStrudel, initAudioOnFirstClick, evaluate, hush, samples, getAudioContext } from '@strudel/web';

let mediaRecorder;
let audioChunks = [];
let recordingStartTime;

// Initialize Strudel
await initStrudel({
  prebake: () => samples('github:tidalcycles/dirt-samples'),
});

// Status helper
function setStatus(message) {
  document.getElementById('status').textContent = message;
}

// Initialize audio on first user interaction
await initAudioOnFirstClick();

// Play button
document.getElementById('play').addEventListener('click', async () => {
  try {
    const code = document.getElementById('pattern').value;
    await evaluate(code);
    setStatus('Playing pattern...');
  } catch (error) {
    setStatus('Error: ' + error.message);
  }
});

// Stop button
document.getElementById('stop').addEventListener('click', () => {
  hush();
  setStatus('Stopped');
});

// Record button
document.getElementById('record').addEventListener('click', async () => {
  try {
    // Get the audio context and destination
    const audioContext = getAudioContext();
    
    // Create a MediaStreamDestination
    const dest = audioContext.createMediaStreamDestination();
    
    // Get the main output node and connect it to our destination
    // This is a bit hacky - in a real implementation, Strudel would provide
    // a proper way to tap into the audio output
    const masterGain = audioContext.createGain();
    masterGain.connect(dest);
    masterGain.connect(audioContext.destination);
    
    // Start recording
    mediaRecorder = new MediaRecorder(dest.stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create download link and audio player
      const recordingDiv = document.createElement('div');
      recordingDiv.innerHTML = `
        <h3>Recording ${new Date().toLocaleTimeString()}</h3>
        <audio controls src="${audioUrl}"></audio>
        <a href="${audioUrl}" download="strudel-recording-${Date.now()}.webm">Download</a>
      `;
      
      document.getElementById('recordings').prepend(recordingDiv);
      setStatus('Recording saved!');
    };
    
    mediaRecorder.start();
    recordingStartTime = Date.now();
    
    // Update UI
    document.getElementById('record').disabled = true;
    document.getElementById('stopRecord').disabled = false;
    setStatus('Recording... (make sure a pattern is playing!)');
    
    // Play the pattern if not already playing
    const code = document.getElementById('pattern').value;
    await evaluate(code);
    
  } catch (error) {
    setStatus('Recording error: ' + error.message);
    console.error(error);
  }
});

// Stop recording button
document.getElementById('stopRecord').addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    
    const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
    setStatus(`Recording stopped. Duration: ${duration}s`);
    
    // Update UI
    document.getElementById('record').disabled = false;
    document.getElementById('stopRecord').disabled = true;
  }
});

setStatus('Ready - Click Play to hear the pattern, or Record to capture it');