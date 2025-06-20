#!/usr/bin/env node

// This script builds a custom Strudel bundle that includes GM soundfonts
// Run this from the audio-export directory

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔨 Building custom Strudel bundle with GM soundfonts...\n');

// Step 1: Check if we're in the right place
const webPackagePath = join(__dirname, '..', 'web');
if (!existsSync(webPackagePath)) {
  console.error('❌ Error: Could not find web package. Run this from packages/audio-export');
  process.exit(1);
}

// Step 2: Modify the web package to include soundfonts
console.log('📝 Modifying web package to include soundfonts...');

const webMjsPath = join(webPackagePath, 'web.mjs');
let webContent = readFileSync(webMjsPath, 'utf8');

// Uncomment soundfonts export
webContent = webContent.replace('//export \\* from \'@strudel/soundfonts\';', 'export * from \'@strudel/soundfonts\';');

// Uncomment registerSoundfonts import
webContent = webContent.replace('// import { registerSoundfonts }', 'import { registerSoundfonts }');

// Uncomment registerSoundfonts call
webContent = webContent.replace('// await registerSoundfonts();', 'await registerSoundfonts();');

// Write modified content
const modifiedWebPath = join(webPackagePath, 'web-with-gm.mjs');
writeFileSync(modifiedWebPath, webContent);

console.log('✅ Created web-with-gm.mjs');

// Step 3: Update package.json to include soundfonts dependency
console.log('\n📦 Adding @strudel/soundfonts to dependencies...');

const packageJsonPath = join(webPackagePath, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

if (!packageJson.dependencies['@strudel/soundfonts']) {
  packageJson.dependencies['@strudel/soundfonts'] = 'workspace:*';
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Added soundfonts dependency');
} else {
  console.log('✅ Soundfonts dependency already exists');
}

// Step 4: Build the modified bundle
console.log('\n🏗️  Building custom bundle...');
console.log('This will take a moment...\n');

try {
  // First install dependencies
  execSync('pnpm install', { 
    cwd: webPackagePath,
    stdio: 'inherit' 
  });
  
  // Create a custom build script
  const buildScript = `
import { build } from 'vite';
import { resolve } from 'path';

await build({
  build: {
    lib: {
      entry: resolve('web-with-gm.mjs'),
      name: 'strudel',
      fileName: 'strudel-with-gm',
      formats: ['es']
    },
    outDir: 'dist-gm',
    emptyOutDir: true
  }
});
`;
  
  const buildScriptPath = join(webPackagePath, 'build-gm.mjs');
  writeFileSync(buildScriptPath, buildScript);
  
  // Run the build
  execSync('node build-gm.mjs', { 
    cwd: webPackagePath,
    stdio: 'inherit' 
  });
  
  console.log('\n✅ Build complete!');
  
  // Copy the built file to audio-export
  const builtFile = join(webPackagePath, 'dist-gm', 'strudel-with-gm.js');
  const targetFile = join(__dirname, 'strudel-with-gm.js');
  
  if (existsSync(builtFile)) {
    const content = readFileSync(builtFile);
    writeFileSync(targetFile, content);
    console.log(`✅ Copied bundle to ${targetFile}`);
  }
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 Success! You now have a custom Strudel bundle with GM sounds.');
console.log('\nTo use it, update exporter.js to import from:');
console.log(`  file://${join(__dirname, 'strudel-with-gm.js')}`);
console.log('\nOr serve it locally and use:');
console.log('  http://localhost:8080/strudel-with-gm.js');