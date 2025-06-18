# StrudelCover

AI-powered tool to automatically recreate songs as Strudel patterns through iterative audio analysis and refinement.

## How It Works

1. **Analyze** - Extract musical features from the original song (tempo, key, rhythm, energy)
2. **Generate** - Create an initial Strudel pattern based on the analysis
3. **Export** - Convert the pattern to audio using Strudel
4. **Compare** - Analyze the generated audio and compare with the original
5. **Refine** - Adjust the pattern to better match the original
6. **Iterate** - Repeat until the similarity score is satisfactory

## Installation

```bash
npm install @strudel/strudelcover
```

You'll also need:
- FFmpeg for audio conversion
- OpenAI API key (required)

## Usage

### CLI

```bash
# Basic usage
strudelcover song.mp3 "Artist Name" "Song Title"

# From YouTube
strudelcover "https://youtube.com/watch?v=..." "The Beatles" "Let It Be"

# With options
strudelcover song.wav "Daft Punk" "Get Lucky" \
  --iterations 10 \
  --target 85 \
  --output ./covers/daft-punk

```

### API

```javascript
import StrudelCover from '@strudel/strudelcover';

const cover = new StrudelCover({
  openaiKey: 'your-api-key',
  maxIterations: 5,
  targetScore: 80
});

const results = await cover.cover(
  'path/to/song.mp3',
  'Artist Name',
  'Song Title'
);

console.log(results.bestPattern); // The Strudel code
console.log(results.bestScore);   // Similarity score (0-100)
```

## Options

- `-k, --api-key <key>` - OpenAI API key (or set OPENAI_API_KEY env var)
- `-o, --output <dir>` - Output directory (default: ./strudelcover-output)
- `-i, --iterations <n>` - Max refinement iterations (default: 5)
- `-t, --target <score>` - Target similarity score 0-100 (default: 80)
- `-d, --duration <seconds>` - Max duration to analyze (default: 30)

## Output

StrudelCover creates an output directory containing:
- `pattern.strudel` - The final Strudel pattern
- `final.wav` - The final audio rendering
- `iteration-N.wav` - Audio from each iteration
- Analysis data and comparison scores

## How Analysis Works

### Audio Features Extracted
- **Tempo** - BPM detection using onset analysis
- **Key** - Detected using chroma features
- **Rhythm** - Kick, snare, and hi-hat patterns
- **Energy** - Overall loudness and dynamics
- **Brightness** - Spectral centroid (frequency content)

### Similarity Scoring
The similarity score (0-100) is calculated based on:
- Tempo accuracy (30%)
- Key match (20%)
- Volume/dynamics similarity (10%)
- Brightness similarity (10%)
- Kick pattern similarity (15%)
- Snare pattern similarity (15%)

## Examples

### Recreate a Simple Beat
```bash
strudelcover drums.wav "Producer" "Beat Name"
```

### Cover a Pop Song
```bash
strudelcover "https://youtube.com/watch?v=dQw4w9WgXcQ" \
  "Rick Astley" "Never Gonna Give You Up" \
  --iterations 10 \
  --target 90
```

### Analyze Without Generation
```javascript
import { AudioAnalyzer } from '@strudel/strudelcover';

const analyzer = new AudioAnalyzer();
const analysis = await analyzer.analyze('song.mp3');

console.log(`Tempo: ${analysis.tempo} BPM`);
console.log(`Key: ${analysis.key}`);
console.log(`Rhythm:`, analysis.rhythm);
```

## Limitations

- Works best with electronic/rhythmic music
- Complex harmonies may be simplified
- Vocal melodies are not transcribed
- Limited to the sounds available in Strudel

## Tips for Best Results

1. **Start with simpler songs** - Electronic, house, techno work well
2. **Increase iterations** - More iterations = better match (but slower)
3. **Use shorter clips** - 30-60 seconds is usually enough
4. **Adjust target score** - 70-80 is realistic for complex songs

## License

AGPL-3.0+