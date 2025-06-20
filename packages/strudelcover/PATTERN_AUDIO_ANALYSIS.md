# Pattern Audio Analysis System

## Overview

The Pattern Audio Analysis system enhances StrudelCover by analyzing the sonic characteristics of patterns in the RAG database and using this information to intelligently select patterns during generation.

## How It Works

### 1. Pattern Characterization

When initialized, the system analyzes all patterns in the RAG database and extracts:

- **Tempo**: BPM ranges from 64 (slow waltz) to 215 (fast energetic)
- **Energy Level**: Estimated from tempo, tags, instruments, and complexity
- **Style**: General, jazz, waltz, techno, latin, rock, synthwave
- **Complexity**: Simple, medium, or complex
- **Instruments**: Piano, synths (saw, square, sine, FM)
- **Tags**: Drums, bass, lead, chords, atmosphere, etc.

### 2. Energy Estimation Algorithm

The system estimates pattern energy using multiple factors:

```javascript
Base energy: 0.5
+ Tempo factor: (tempo - 120) / 200
+ High energy tags (drums, kick, bass, lead): +0.1 each
- Low energy tags (atmosphere, ambient, pad): -0.1 each
+ Complex patterns: +0.1
- Simple patterns: -0.1
+ Energetic instruments (synth-saw, fm-synth): +0.1
- Mellow instruments (piano, synth-sine): -0.1
```

### 3. Pattern Matching

The system finds matching patterns based on:

1. **Tempo Matching** (30% weight)
   - Configurable tolerance (default: ±10 BPM)
   - Higher scores for closer matches

2. **Energy Matching** (25% weight)
   - Compares estimated energy levels
   - Configurable tolerance (default: ±0.2)

3. **Key Compatibility** (20% weight)
   - Same key = 100% match
   - Relative major/minor = 80% match
   - Circle of fifths neighbors = 60%/40%

4. **Tag Preferences** (5% per tag)
   - Bonus for preferred tags
   - Penalty for avoided tags

5. **Style/Genre Matching** (15% weight)
   - Bonus for matching musical styles

### 4. Section-Based Selection

The system suggests different patterns for each song section:

- **Intro**: Simple, low energy (0.3), atmospheric tags
- **Verse**: Medium complexity, moderate energy (0.5), chords/bass
- **Chorus**: Medium complexity, high energy (0.8), drums/lead
- **Bridge**: Complex, varied energy (0.6), atmospheric/lead
- **Outro**: Simple, low energy (0.2), atmospheric/pad

## Usage Examples

### Basic Pattern Matching

```javascript
import { patternAudioAnalyzer } from './pattern-audio-analyzer.js';

// Find patterns for high-energy electronic music
const matches = patternAudioAnalyzer.findMatchingPatterns({
  tempo: 140,
  key: 'c:minor',
  features: { energy: 0.9 },
  genre: 'electronic'
}, {
  preferredTags: ['drums', 'bass'],
  limit: 5
});
```

### Section Suggestions

```javascript
// Get pattern suggestions for different song sections
const suggestions = patternAudioAnalyzer.suggestPatternsForSections(
  targetAnalysis,
  songStructure
);

// Returns patterns optimized for each section type
suggestions.intro   // Low energy, atmospheric
suggestions.verse   // Moderate energy, rhythmic
suggestions.chorus  // High energy, full arrangement
```

## Integration with Generators

### Dazzle Generator

The Dazzle generator uses pattern audio analysis to:
1. Find patterns that match the target song's characteristics
2. Prioritize audio-matched patterns over pure text matching
3. Combine with RAG retrieval for best results

### Complex Generator

The Complex generator uses it to:
1. Log suggested patterns for each section
2. Inform the generation process with real examples
3. Maintain consistency across sections

## Pattern Database Statistics

Current database contains 60 patterns:
- **Tempo**: 75% are upbeat (90-140 BPM)
- **Complexity**: 52% medium, 25% simple, 23% complex
- **Instruments**: 50% use piano, 27% use synth-saw
- **Styles**: 78% general, with jazz, waltz, techno minorities

## Benefits

1. **Better Pattern Selection**: Matches patterns based on actual sonic characteristics
2. **Section Awareness**: Different patterns for different song sections
3. **Genre Consistency**: Maintains stylistic coherence
4. **Energy Progression**: Builds natural energy curves throughout songs
5. **Instrument Variety**: Ensures diverse but compatible sounds

## Future Enhancements

1. **Actual Audio Analysis**: Analyze rendered audio for true sonic matching
2. **Machine Learning**: Train models on pattern-to-audio relationships
3. **User Preferences**: Learn from user selections and feedback
4. **Harmonic Analysis**: Deeper chord progression matching
5. **Rhythm Patterns**: Extract and match rhythmic signatures