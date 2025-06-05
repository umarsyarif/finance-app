const { spawn } = require('child_process');
const path = require('path');

// Compile TypeScript files first
const tsc = spawn('npx', ['tsc', '--project', 'tsconfig.json'], {
  stdio: 'inherit',
  cwd: __dirname
});

tsc.on('close', (code) => {
  if (code === 0) {
    // Run tests on compiled JavaScript files
    const mocha = spawn('npx', ['mocha', 'build/tests/**/*.spec.js', '--timeout', '10000'], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    mocha.on('close', (testCode) => {
      process.exit(testCode);
    });
  } else {
    console.error('TypeScript compilation failed');
    process.exit(1);
  }
});