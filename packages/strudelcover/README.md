# StrudelCover

AI-powered tool to automatically recreate songs as Strudel patterns through iterative audio analysis and refinement.

## How It Works

1. **Analyze** - Extract musical features from the original song (tempo, key, rhythm, energy)
2. **Generate** - Create an initial Strudel pattern based on the analysis
3. **Export** - Convert the pattern to audio using Strudel
4. **Compare** - Analyze the generated audio and compare with the original
5. **Refine** - Adjust the pattern to better match the original
6. **Iterate** - Repeat until the similarity score is satisfactory

## Features

- Multiple LLM providers: OpenAI (GPT-4o), Anthropic (Claude), Ollama (local)
- Two modes: Auto mode (overall score) and Manual mode (per-metric thresholds)
- Configurable iteration limits and similarity targets
- Custom weights for scoring algorithm
- Per-metric threshold control for precise matching
- **Pattern Audio Analysis**: Intelligent pattern selection based on sonic characteristics
- RAG (Retrieval Augmented Generation) with 60+ curated Strudel patterns

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

# Using different LLM providers
strudelcover song.mp3 "Artist" "Song" --llm anthropic
strudelcover song.mp3 "Artist" "Song" --llm ollama --model llama2

# Manual threshold mode
strudelcover song.mp3 "Artist" "Song" \
  --manual \
  --tempo-threshold 3 \
  --require-key-match \
  --kick-threshold 0.8
```

### API

```javascript
import StrudelCover from '@strudel/strudelcover';

// Legacy: OpenAI with API key
const cover = new StrudelCover({
  openaiKey: 'your-api-key',
  maxIterations: 5,
  targetScore: 80
});

// New: Specify LLM provider
const cover = new StrudelCover({
  llm: 'anthropic',
  llmConfig: {
    apiKey: 'your-anthropic-key',
    model: 'claude-3-5-sonnet-20241022'
  }
});

// Use Ollama (local models)
const cover = new StrudelCover({
  llm: 'ollama',
  llmConfig: {
    model: 'llama2',
    baseURL: 'http://localhost:11434'
  }
});

// Manual mode with per-metric thresholds
const cover = new StrudelCover({
  openaiKey: 'your-api-key',
  autoMode: false,
  maxIterations: 10,
  thresholds: {
    tempo: 3,              // Max BPM difference
    key: true,             // Require key match
    energy: 0.05,          // Max energy difference
    brightness: 0.15,      // Max brightness difference
    kickSimilarity: 0.8,   // Min kick pattern similarity
    snareSimilarity: 0.8   // Min snare pattern similarity
  }
});

// Custom weights for scoring
const cover = new StrudelCover({
  openaiKey: 'your-api-key',
  weights: {
    tempo: 0.4,           // Increase tempo importance
    key: 0.3,             // Increase key importance
    energy: 0.1,
    brightness: 0.05,
    kickSimilarity: 0.1,
    snareSimilarity: 0.05
  }
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

### CLI Options
- `-k, --api-key <key>` - OpenAI API key (or set OPENAI_API_KEY env var)
- `-o, --output <dir>` - Output directory (default: ./strudelcover-output)
- `-i, --iterations <n>` - Max refinement iterations (default: 5)
- `-t, --target <score>` - Target similarity score 0-100 (default: 80)
- `-d, --duration <seconds>` - Max duration to analyze (default: 30)
- `-m, --manual` - Use manual threshold mode instead of auto score mode
- `--llm <provider>` - LLM provider: openai, anthropic, ollama (default: openai)
- `--model <model>` - LLM model to use
- `--llm-base-url <url>` - Custom LLM API endpoint
- `--tempo-threshold <bpm>` - Max tempo difference in BPM (default: 5)
- `--energy-threshold <diff>` - Max energy difference (default: 0.1)
- `--brightness-threshold <diff>` - Max brightness difference (default: 0.2)
- `--kick-threshold <similarity>` - Min kick pattern similarity (default: 0.7)
- `--snare-threshold <similarity>` - Min snare pattern similarity (default: 0.7)
- `--require-key-match` - Require exact key match

### API Options
- `openaiKey` - OpenAI API key (legacy, use llm/llmConfig instead)
- `llm` - LLM provider name ('openai', 'anthropic', 'ollama') or provider instance
- `llmConfig` - LLM configuration object:
  - `apiKey` - API key for the provider
  - `model` - Model name to use
  - `baseURL` - Custom API endpoint
  - `temperature` - Generation temperature
- `autoMode` - Use auto mode (default: true)
- `maxIterations` - Maximum refinement iterations (default: 5)
- `targetScore` - Target similarity score for auto mode (default: 80)
- `thresholds` - Per-metric thresholds for manual mode
- `weights` - Custom weights for scoring algorithm
- `outputDir` - Output directory path

## Modes

### Auto Mode (default)
- Uses a weighted overall similarity score (0-100)
- Stops when target score is reached or max iterations
- Good for general use and quick results

### Manual Mode
- Must meet ALL specified thresholds
- Provides fine-grained control over each metric
- Good for precise matching requirements

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

#### Default Weights
The similarity score (0-100) is calculated based on:
- Tempo accuracy (30%)
- Key match (20%)
- Volume/dynamics similarity (10%)
- Brightness similarity (10%)
- Kick pattern similarity (15%)
- Snare pattern similarity (15%)

#### Custom Weights
You can adjust the importance of each metric by providing custom weights that sum to 1.0.

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

## Pattern Audio Analysis

StrudelCover uses an intelligent pattern selection system that analyzes the sonic characteristics of patterns in the RAG database:

- **Tempo Matching**: Finds patterns with similar BPM (±10 BPM tolerance)
- **Energy Matching**: Matches patterns based on estimated energy levels
- **Key Compatibility**: Prioritizes harmonically compatible patterns
- **Tag-Based Selection**: Uses tags like 'drums', 'bass', 'atmosphere' for appropriate layers
- **Section Awareness**: Suggests different patterns for intro, verse, chorus, bridge, outro

The system analyzes 60+ curated patterns and selects the most appropriate ones based on:
- Tempo (64-215 BPM range)
- Energy level (estimated from tempo, tags, instruments)
- Musical style (general, jazz, techno, etc.)
- Complexity (simple, medium, complex)
- Instrumentation (piano, synths, drums)

See [PATTERN_AUDIO_ANALYSIS.md](./PATTERN_AUDIO_ANALYSIS.md) for detailed documentation.

## LLM Providers

### OpenAI (default)
```javascript
// Uses GPT-4o by default
const cover = new StrudelCover({
  llm: 'openai',
  llmConfig: { apiKey: 'sk-...' }
});
```

### Anthropic Claude
```javascript
// Uses Claude 3.5 Sonnet by default
const cover = new StrudelCover({
  llm: 'anthropic',
  llmConfig: { apiKey: 'sk-ant-...' }
});
```

### Ollama (Local)
```javascript
// No API key needed
const cover = new StrudelCover({
  llm: 'ollama',
  llmConfig: {
    model: 'llama2',
    baseURL: 'http://localhost:11434'
  }
});
```

### Custom Provider
```javascript
import { BaseLLMProvider } from '@strudel/strudelcover';

class MyCustomProvider extends BaseLLMProvider {
  async generateCompletion(messages, options) {
    // Your implementation
    return generatedText;
  }
}

const cover = new StrudelCover({
  llm: new MyCustomProvider({ /* config */ })
});
```

## License

AGPL-3.0+