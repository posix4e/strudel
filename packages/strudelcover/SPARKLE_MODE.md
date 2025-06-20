# Sparkle Mode - Enhanced Visual Effects & Runtime Error Learning

## Overview

Sparkle Mode combines cyberpunk visual aesthetics with intelligent runtime error learning. It enhances the StrudelCover experience with Matrix-style animations while capturing actual runtime errors from the audio export process to help the LLM learn what works.

## Key Features

### 1. **Visual Effects**
- Matrix rain animation during startup
- ASCII art title screen
- Visual frequency spectrum analyzer
- Rhythm pattern visualization
- Glitch effects for errors
- Progress bars with waveform visualization
- Big number displays for scores

### 2. **Runtime Error Learning**
- Captures actual Strudel runtime errors from the browser
- Shows errors with cool glitch effects
- Learns corrections (e.g., "triangle" → "tri")
- Passes runtime errors directly to the LLM
- No Puppeteer required - uses existing audio export

### 3. **Layer Analysis**
- Analyzes stack patterns layer by layer
- Identifies which layer contains errors
- Visual breakdown of pattern structure
- Helps LLM understand what parts work

### 4. **Enhanced Pattern Generation**
- Adds visual comments to patterns
- Includes real-time visualizers in the generated code
- Creates cyberpunk-themed pattern files

## Usage

### Enable Sparkle Mode

```bash
npm run cover song.mp3 "Artist" "Title" -- --sparkle
```

### What You'll See

1. **Epic Intro**: Matrix rain effect with cyber loading messages
2. **Visual Analysis**: Frequency spectrum and rhythm patterns
3. **LLM Thinking**: Neural network animation while generating
4. **Error Learning**: If errors occur, see glitch effects and corrections
5. **Pattern Enhancement**: Final pattern includes visualizers

### Example Visual Output

```
╔═══════════════════════════════════════╗
║   🎵 AUDIO ANALYSIS MATRIX 🎵   ║
╚═══════════════════════════════════════╝
TEMPO   : ███████████████ 150 BPM
ENERGY  : [▓▓▓░░░░░░░░░░░░░░░░░] 17.0%

FREQUENCY SPECTRUM:
  100Hz ███████████████████████████████████████████████████████████░
  200Hz ███████████████████████████████████████████████████████████░
  500Hz █████████████████████████████████████████████████████████░░░
```

### Runtime Error Display

When an error is detected:

```
╔═══════════════════════════════════════╗
║   💀 RUNTIME ERROR DETECTED 💀   ║
╚═══════════════════════════════════════╝

ERROR: tri█ng█e is no█ d█fi█ed

🧠 LEARNING: "triangle" is not valid
✓ CORRECTION: Use "tri" instead
```

## How It Works

1. **During Audio Export**: The browser console is monitored for errors
2. **Error Capture**: Runtime errors like "sound not found" are captured
3. **Visual Feedback**: Errors shown with glitch effects
4. **LLM Learning**: Errors passed to LLM in recovery prompts
5. **Pattern Correction**: LLM learns and avoids the error next time

## Benefits Over Dazzle Mode

- **No Puppeteer Required**: Uses existing audio export process
- **Better Integration**: Works seamlessly with audio generation
- **Visual Feedback**: See what's happening in real-time
- **Actual Errors**: Captures real runtime errors, not simulated
- **Cool Factor**: Matrix-style visuals make it fun to watch

## Technical Details

- Uses chalk for colors and effects
- Monitors browser console during audio export
- Extracts runtime errors from export process
- Layer-by-layer pattern analysis
- Learned corrections stored in memory

## Example Patterns Generated

Sparkle mode adds visual enhancements to patterns:

```javascript
// ═══════════════════════════════════════════
// ║ STRUDELCOVER PATTERN SYNTHESIS v2.0     ║
// ║ [SPARKLE MODE ACTIVE]                   ║
// ═══════════════════════════════════════════

setcps(150/60/4)

$: stack(
  s("bd*4").gain(0.6),
  n("40 52").s("tri").gain(0.3), // Learned to use "tri"
  
  // SPECTRUM ANALYZER
  .analyze(['spectrum'])
  .onTrigger((t, e) => {
    console.log('[SPECTRUM]', visualize(e.value));
  })
).room(0.3)
```

## Future Enhancements

1. More visual effects and animations
2. Pattern success/failure statistics
3. Community error database
4. Real-time pattern preview
5. Interactive error correction