#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing swagger-mcp server initialization...');

const serverProcess = spawn('node', [join(__dirname, '../src/server.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let testCompleted = false;

// Force kill after 5 seconds regardless
const forceTimeout = setTimeout(() => {
  if (!testCompleted) {
    console.log('❌ Server initialization test timed out');
    serverProcess.kill('SIGKILL');
    process.exit(1);
  }
}, 5000);

// Simple test: if server starts and doesn't crash within 2 seconds, it's working
const successTimeout = setTimeout(() => {
  if (!testCompleted) {
    console.log('✅ Server started and remained stable for 2 seconds');
    testCompleted = true;
    clearTimeout(forceTimeout);
    serverProcess.kill('SIGTERM');
    
    setTimeout(() => {
      console.log('✅ All tests passed - Server can be initialized properly');
      process.exit(0);
    }, 100);
  }
}, 2000);

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  clearTimeout(forceTimeout);
  clearTimeout(successTimeout);
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  clearTimeout(forceTimeout);
  clearTimeout(successTimeout);
  
  if (testCompleted) {
    console.log('✅ Server terminated gracefully after successful test');
    process.exit(0);
  } else if (code !== 0 && signal !== 'SIGTERM') {
    console.error(`❌ Server exited unexpectedly with code ${code}`);
    process.exit(1);
  }
});

// Check for any error output
serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  // Only fail on actual errors, not warnings
  if (output.toLowerCase().includes('error:') || output.includes('throw ')) {
    console.error('❌ Server error detected:', output);
    clearTimeout(forceTimeout);
    clearTimeout(successTimeout);
    serverProcess.kill('SIGTERM');
    process.exit(1);
  }
});
