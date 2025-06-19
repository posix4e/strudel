# StrudelCover Output Structure

When running StrudelCover, all outputs should be organized as follows:

```
strudelcover-output/
├── 2024-06-19_15-30-45_grimes_genesis/    # Timestamp + artist + song
│   ├── config.json                         # Run configuration
│   ├── analysis/                           # Audio analysis results
│   │   ├── basic_analysis.json            # Tempo, key, energy, etc.
│   │   ├── structure_analysis.json        # Sections, bars, measures
│   │   ├── spectral_features.json         # Detailed audio features
│   │   └── rhythm_patterns.json           # Extracted rhythm patterns
│   ├── iterations/                         # Each attempt at pattern generation
│   │   ├── iteration_001/
│   │   │   ├── pattern.strudel           # Complete pattern for this iteration
│   │   │   ├── layers/                   # Individual layer patterns
│   │   │   │   ├── kick.strudel
│   │   │   │   ├── snare.strudel
│   │   │   │   ├── bass.strudel
│   │   │   │   └── ...
│   │   │   ├── audio.wav                 # Rendered audio
│   │   │   ├── comparison.json           # Similarity scores
│   │   │   └── llm_prompts.txt          # Exact prompts sent to LLM
│   │   ├── iteration_002/
│   │   └── ...
│   ├── final/                             # Best/final version
│   │   ├── pattern.strudel
│   │   ├── audio.wav
│   │   └── report.md                     # Summary of the process
│   └── logs/
│       ├── console.log                    # All console output
│       ├── errors.log                     # Any errors encountered
│       └── llm_responses.json             # Raw LLM responses
```

## Why This Structure?

1. **Full Traceability** - See exactly what was tried at each step
2. **Debugging** - Easy to find what went wrong
3. **Learning** - Can analyze what patterns work best
4. **Reproducibility** - Can replay any iteration
5. **Progress Tracking** - Visual indication of improvement over iterations