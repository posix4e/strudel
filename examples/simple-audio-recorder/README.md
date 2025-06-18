# Simple Audio Recording Examples for Strudel

This directory contains examples of how to record/export audio from Strudel patterns.

## Browser-based Recording (Working Example)

The `index.html` and `recorder.js` files demonstrate a working approach using the MediaRecorder API to capture audio in real-time while patterns play.

### How to run:
```bash
# From this directory
pnpm install
pnpm dev
```

Then open http://localhost:5173 in your browser.

### Features:
- Records patterns in real-time as they play
- Saves recordings as WebM audio files
- Simple UI with play/stop/record controls
- Shows all recordings with playback and download options

### Limitations:
- Records in real-time (not faster than real-time)
- Output format is WebM (browser-dependent)
- Requires patterns to actually play through speakers

## Command-line Export (Conceptual)

The `export-pattern.js` file shows what a command-line tool might look like, but it's currently just a conceptual example because:

1. Strudel is designed for browsers and uses Web Audio API
2. Would require significant work to port to Node.js
3. Would need Node.js-compatible audio libraries

## Future Possibilities

For proper offline audio export, Strudel would need:

1. **OfflineAudioContext support** in the core audio engine
2. **Pre-calculation** of all pattern events
3. **Batch scheduling** of audio events
4. **Sample preloading** before rendering
5. **File format encoding** (WAV, MP3, etc.)

The current architecture makes real-time recording (via MediaRecorder) the most practical approach.