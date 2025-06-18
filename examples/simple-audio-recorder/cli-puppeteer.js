#!/usr/bin/env node

/**
 * CLI tool to record Strudel patterns using Puppeteer
 * 
 * Usage: node cli-puppeteer.js "pattern" output.webm duration
 * Example: node cli-puppeteer.js "s('bd*4, hh*8')" drums.webm 8
 */

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('🎵 Strudel Pattern Recorder (Puppeteer version)');
  console.log('\nUsage: node cli-puppeteer.js "pattern" output.webm duration');
  console.log('\nExamples:');
  console.log('  node cli-puppeteer.js "s(\'bd*4, hh*8\')" drums.webm 8');
  console.log('  node cli-puppeteer.js "note(\'c3 e3 g3 b3\').s(\'sawtooth\')" melody.webm 4');
  process.exit(1);
}

const [pattern, outputFile, duration] = args;
const durationMs = parseFloat(duration) * 1000;

console.log('🎹 Pattern:', pattern);
console.log('💾 Output:', resolve(outputFile));
console.log('⏱️  Duration:', duration, 'seconds\n');

async function recordPattern() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log('📱', msg.text());
    }
  });

  // Set up the recording page
  await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <title>Strudel CLI Recorder</title>
  <style>
    body { 
      font-family: monospace; 
      padding: 20px;
      background: #1a1a1a;
      color: #00ff00;
    }
    h1 { margin-bottom: 20px; }
    #status {
      background: #000;
      padding: 20px;
      border: 1px solid #00ff00;
      white-space: pre;
      line-height: 1.5;
      font-size: 14px;
    }
    .pattern {
      background: #000;
      padding: 10px;
      margin: 10px 0;
      border: 1px solid #444;
      color: #0ff;
    }
  </style>
</head>
<body>
  <h1>🎵 Strudel CLI Recorder</h1>
  <div class="pattern">Pattern: ${pattern}</div>
  <pre id="status">Initializing...</pre>
</body>
</html>`);

  // Inject and run the recording script
  const recordingData = await page.evaluate(async (pattern, durationMs) => {
    const status = document.getElementById('status');
    const log = (msg) => {
      status.textContent += '\\n' + msg;
      console.log(msg);
    };

    // Dynamically import Strudel
    const { initStrudel, initAudioOnFirstClick, evaluate, hush, samples, getAudioContext } = 
      await import('https://unpkg.com/@strudel/web@latest/dist/index.js');

    try {
      log('📦 Loading Strudel...');
      await initStrudel({
        prebake: () => samples('github:tidalcycles/dirt-samples'),
      });

      log('🎤 Initializing audio context...');
      await initAudioOnFirstClick();
      const audioContext = getAudioContext();

      log('🔌 Setting up recording...');
      const dest = audioContext.createMediaStreamDestination();
      
      // Properly connect to Strudel's output
      // Note: This is a simplified version - ideally we'd hook into Strudel's master output
      const originalConnect = audioContext.destination.connect;
      audioContext.destination.connect = function(...args) {
        originalConnect.apply(this, args);
        if (args[0] && args[0].connect) {
          args[0].connect(dest);
        }
      };

      const mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: 'audio/webm'
      });
      const chunks = [];

      return new Promise((resolve) => {
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        
        mediaRecorder.onstop = async () => {
          log('💾 Processing recording...');
          const blob = new Blob(chunks, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            log('✅ Recording complete!');
            resolve({
              success: true,
              data: reader.result.split(',')[1],
              mimeType: 'audio/webm'
            });
          };
          reader.readAsDataURL(blob);
        };

        // Start pattern and recording
        log('🎹 Starting pattern...');
        evaluate(pattern).then(() => {
          log('🔴 Recording...');
          mediaRecorder.start();

          // Stop after duration
          setTimeout(() => {
            log('⏹️  Stopping...');
            hush();
            mediaRecorder.stop();
          }, durationMs);
        });
      });

    } catch (error) {
      log('❌ Error: ' + error.message);
      return { success: false, error: error.message };
    }
  }, pattern, durationMs);

  await browser.close();

  if (recordingData.success) {
    // Save the recording
    const buffer = Buffer.from(recordingData.data, 'base64');
    writeFileSync(outputFile, buffer);
    
    console.log('\n✅ Recording saved successfully!');
    console.log(`📁 File: ${resolve(outputFile)}`);
    console.log(`📊 Size: ${(buffer.length / 1024).toFixed(1)} KB`);
  } else {
    console.error('\n❌ Recording failed:', recordingData.error);
    process.exit(1);
  }
}

// Run the recorder
console.log('🚀 Starting Puppeteer...\n');
recordPattern().catch(console.error);