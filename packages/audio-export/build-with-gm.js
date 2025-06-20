#!/usr/bin/env node

// Script to build a custom Strudel bundle with GM soundfonts included
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Building custom Strudel bundle with GM soundfonts...');

// Read the web.mjs file
const webPath = join(__dirname, '..', 'web', 'web.mjs');
let webContent = readFileSync(webPath, 'utf8');

// Uncomment the soundfonts export
webContent = webContent.replace('//export * from \'@strudel/soundfonts\';', 'export * from \'@strudel/soundfonts\';');

// Uncomment the registerSoundfonts import
webContent = webContent.replace('// import { registerSoundfonts } from \'@strudel/soundfonts\';', 'import { registerSoundfonts } from \'@strudel/soundfonts\';');

// Uncomment the registerSoundfonts call in defaultPrebake
webContent = webContent.replace('// await registerSoundfonts();', 'await registerSoundfonts();');

// Write to a new file
const outputPath = join(__dirname, 'strudel-with-gm.mjs');
writeFileSync(outputPath, webContent);

console.log(`Custom bundle written to: ${outputPath}`);
console.log('\nNext steps:');
console.log('1. Add @strudel/soundfonts to web package dependencies');
console.log('2. Build the web package with: npm run build');
console.log('3. Use the built bundle in audio-export');