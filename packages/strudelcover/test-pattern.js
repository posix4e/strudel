// Test manual pattern generation
import { PatternGenerator } from './src/generator.js';
import { config } from 'dotenv';

config({ path: '../../.env' });

const generator = new PatternGenerator(process.env.OPENAI_API_KEY);

const analysis = {
  tempo: 120,
  key: 'C',
  duration: 8,
  rhythm: {
    kick: [0, 0.5, 1, 1.5],
    snare: [0.5, 1.5],
    hihat: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]
  },
  features: {
    energy: 0.7,
    spectralCentroid: 2000,
    rms: 0.5,
    zcr: 0.1
  }
};

const pattern = await generator.generateFromAnalysis(analysis, "Test", "Simple Beat");
console.log("Generated pattern:");
console.log(pattern);