# StrudelCover RAG System

A Retrieval-Augmented Generation (RAG) system for improving Strudel pattern generation accuracy by retrieving relevant pattern examples.

## Overview

The RAG system enhances StrudelCover's pattern generation by:
- Storing a database of known working Strudel patterns
- Retrieving relevant examples based on musical context
- Validating generated patterns for syntax correctness
- Providing pattern examples to the LLM for better generation

## Components

### 1. Vector Database (`database.js`)
- Local storage using JSON files
- Cosine similarity search
- Metadata filtering (type, section, tempo, style)
- Can be extended to use cloud solutions (Pinecone, ChromaDB)

### 2. Embeddings Generator (`embeddings.js`)
- Uses OpenAI's text-embedding-3-small model
- Enhanced embeddings with musical context
- Batch processing support
- Pattern characteristic extraction

### 3. Pattern Parser (`parser.js`)
- Extracts patterns from strudel-songs-collection
- Multiple parsing strategies (comments, functions, variables)
- Automatic metadata extraction
- Pattern deduplication

### 4. Retrieval System (`retrieval.js`)
- Context-aware pattern search
- Musical relevance re-ranking
- Section-specific retrieval
- Similar pattern finding

### 5. Pattern Validator (`validator.js`)
- Syntax validation
- Method name checking
- Common issue detection
- Auto-fix capabilities

## Setup

### 1. Set OpenAI API Key
```bash
export OPENAI_API_KEY=your-api-key
```

### 2. Initialize the Database
```bash
npx strudelcover-rag init
```

This will:
- Load default patterns
- Clone and parse strudel-songs-collection (if available)
- Generate embeddings for all patterns

## Usage

### In Code

```javascript
import { rag } from './rag/index.js';

// Initialize
await rag.initialize();

// Retrieve patterns
const patterns = await rag.retrieve({
  type: 'bass',
  section: 'verse',
  tempo: 120,
  key: 'C major',
  style: 'electronic'
});

// Validate a pattern
const validation = rag.validatePattern(pattern);
if (!validation.valid) {
  pattern = rag.autoFixPattern(pattern);
}

// Add a new pattern
await rag.addPattern(code, {
  type: 'drums',
  tempo: 140,
  section: 'intro'
});
```

### CLI Commands

```bash
# Initialize database
npx strudelcover-rag init

# Show statistics
npx strudelcover-rag stats

# Search patterns
npx strudelcover-rag search "electronic bass" --type bass --tempo 130

# Add a pattern
npx strudelcover-rag add pattern.strudel --type drums --tempo 120

# Validate a pattern
npx strudelcover-rag validate pattern.strudel --fix

# Clear database
npx strudelcover-rag clear --confirm
```

## Integration with DazzleGenerator

The RAG system is automatically integrated into the dazzle-generator:

1. **Pattern Retrieval**: Before generating each layer, relevant examples are retrieved
2. **Prompt Enhancement**: Examples are included in the LLM prompt
3. **Validation**: Generated patterns are validated and auto-fixed if needed
4. **Learning**: New successful patterns can be added back to the database

## Pattern Quality

The system improves pattern quality by:
- Providing working examples as references
- Ensuring syntactic correctness
- Maintaining musical coherence
- Learning from successful generations

## Extending the System

### Adding Pattern Sources
1. Implement new parsing strategies in `parser.js`
2. Add patterns using the CLI or API
3. Parse from documentation or tutorials

### Custom Embeddings
1. Extend `EmbeddingsGenerator` class
2. Add musical feature extraction
3. Implement custom similarity metrics

### Cloud Database
1. Implement database interface
2. Replace `VectorDatabase` with cloud solution
3. Maintain same API surface

## Troubleshooting

### No OpenAI API Key
- System will work with type-based retrieval only
- No semantic search available
- Set `OPENAI_API_KEY` environment variable

### Pattern Validation Failures
- Check error messages for specific issues
- Use `--fix` flag for auto-fix
- Common issues: missing quotes, unbalanced parentheses

### Low Retrieval Quality
- Ensure database is initialized
- Add more relevant patterns
- Adjust search parameters (topK, similarity threshold)