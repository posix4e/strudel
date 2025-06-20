# @strudel/audio-export

Audio export tools for Strudel - convert your live coding patterns into audio files.

## Features

- 🎵 Export Strudel patterns to audio files
- 🎯 Multiple format support: WebM, WAV, MP3, OGG, FLAC
- 🚀 CLI tool for quick exports
- 📚 Programmatic API for integration
- 🎛️ Configurable quality and encoding settings
- 🔄 Batch export support
- 🌐 Works with any Strudel pattern

## Installation

```bash
npm install @strudel/audio-export
```

For format conversion (WAV, MP3, etc.), you'll also need FFmpeg:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

## CLI Usage

### Basic Export

```bash
# Export to WebM (default)
strudel-export "s('bd*4, hh*8')" drums.webm

# Export to WAV
strudel-export "note('c3 e3 g3 b3').s('sawtooth')" melody.wav

# Export to MP3 with custom bit rate
strudel-export "s('jazz').chop(8)" jazz.mp3 --bit-rate 320k
```

### Options

```bash
strudel-export <pattern> <output> [options]

Options:
  -d, --duration <seconds>     Duration in seconds (default: 8)
  -f, --format <format>        Output format (auto-detected from filename)
  -q, --quality <quality>      Audio quality: low, medium, high (default: high)
  --headless                   Run in headless mode (no browser window)
  --sample-rate <rate>         Sample rate for WAV output (default: 44100)
  --bit-rate <rate>           Bit rate for MP3 output (default: 192k)
  --prebake <code>            Custom prebake code (default: comprehensive prebake with GM sounds)
  --simple-prebake            Use simple prebake (only dirt-samples, no GM sounds)
```

### Examples

```bash
# Long ambient piece
strudel-export "note('c2 f2 g2').s('pad').slow(4)" ambient.wav -d 60

# High quality MP3
strudel-export "stack(s('bd*4'), s('hh*8').gain(0.5))" beat.mp3 --bit-rate 320k --quality high

# Custom samples
strudel-export "s('mysamples:kick*4')" custom.webm --prebake "samples('mysamples', 'https://example.com/samples/')"

# Headless mode (no browser window)
strudel-export "s('cp').every(4, rev)" pattern.wav --headless

# GM sounds (General MIDI)
strudel-export "n('0 2 4 7').s('gm_piano')" piano.wav
strudel-export "n('0 3 5 7').s('gm_violin').room(1)" violin.mp3
```

### GM Sound Support

The audio exporter includes support for General MIDI (GM) sounds by default. These are high-quality soundfonts that provide realistic instrument sounds:

- `gm_piano` - Various piano sounds
- `gm_harmonica` - Harmonica
- `gm_violin` - Violin sounds
- `gm_electric_bass_finger` - Electric bass
- And many more GM instruments...

GM sounds are loaded automatically with the comprehensive prebake. If you want to disable GM sounds for faster loading, use the `--simple-prebake` flag:

```bash
# Without GM sounds (faster loading)
strudel-export "s('bd*4')" drums.wav --simple-prebake
```

## Programmatic API

### Basic Usage

```javascript
import StrudelAudioExport from '@strudel/audio-export';

const exporter = new StrudelAudioExport();

// Export to file
await exporter.exportToFile(
  "s('bd*4, hh*8')",
  'output/drums.wav',
  { duration: 16 }
);

// Export to buffer
const buffer = await exporter.exportToBuffer(
  "note('c3 e3 g3').s('piano')",
  { format: 'mp3', quality: 'high' }
);

// Export to stream
const stream = await exporter.exportToStream(
  "s('jazz').chop(8)",
  { format: 'wav' }
);
```

### Advanced Features

#### Batch Export

```javascript
const patterns = [
  { pattern: "s('bd*4')", output: 'drums/kick.wav' },
  { pattern: "s('hh*8')", output: 'drums/hihat.wav' },
  { pattern: "s('cp')", output: 'drums/clap.wav', options: { duration: 4 } }
];

const results = await exporter.exportBatch(patterns);
```

#### Render Queue

```javascript
const queue = exporter.createRenderQueue();

// Add patterns to queue
queue.add("s('bd*4')", 'kick.wav');
queue.add("s('hh*8')", 'hihat.wav');
queue.add("s('cp')", 'clap.wav');

// Check status
console.log(queue.getStatus()); // { pending: 2, processing: true }
```

#### Custom Configuration

```javascript
const exporter = new StrudelAudioExport({
  duration: 16,              // Default duration
  format: 'wav',            // Default format
  quality: 'high',          // Default quality
  headless: true,           // Always run headless
  sampleRate: 48000,        // Higher sample rate
  prebake: "samples('github:tidalcycles/dirt-samples')" // Custom samples
});
```

## Web Integration

```javascript
// In a web application
async function exportUserPattern() {
  const pattern = document.getElementById('pattern-input').value;
  const exporter = new StrudelAudioExport({ headless: true });
  
  try {
    const buffer = await exporter.exportToBuffer(pattern, {
      format: 'mp3',
      duration: 8
    });
    
    // Create download link
    const blob = new Blob([buffer], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattern.mp3';
    a.click();
  } catch (error) {
    console.error('Export failed:', error);
  }
}
```

## Express.js Server Example

```javascript
import express from 'express';
import StrudelAudioExport from '@strudel/audio-export';

const app = express();
const exporter = new StrudelAudioExport();

app.post('/export', express.json(), async (req, res) => {
  const { pattern, format = 'mp3', duration = 8 } = req.body;
  
  try {
    const buffer = await exporter.exportToBuffer(pattern, {
      format,
      duration
    });
    
    res.setHeader('Content-Type', `audio/${format}`);
    res.setHeader('Content-Disposition', `attachment; filename="pattern.${format}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## Supported Formats

| Format | Extension | Type | Notes |
|--------|-----------|------|-------|
| WebM | .webm | Compressed | Native browser format, no conversion needed |
| WAV | .wav | Lossless | Requires FFmpeg |
| MP3 | .mp3 | Compressed | Requires FFmpeg |
| OGG | .ogg | Compressed | Requires FFmpeg |
| FLAC | .flac | Lossless compressed | Requires FFmpeg |

## Quality Settings

- **high**: Best quality, larger file sizes
- **medium**: Balanced quality and file size
- **low**: Smaller files, reduced quality

## Troubleshooting

### FFmpeg not found
Install FFmpeg for format conversion support:
- macOS: `brew install ffmpeg`
- Linux: `sudo apt-get install ffmpeg`
- Windows: Download from https://ffmpeg.org

### Pattern errors
Ensure your pattern syntax is valid. Test in the Strudel REPL first.

### Browser timeout
For long exports, increase the duration gradually or use headless mode.

## License

AGPL-3.0+