const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const bundlePath = path.resolve(__dirname, '..', 'predictive-arc.json');
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));

console.log('Unpacking', bundle.files.length, 'files...');

// Extract all registered files
for (const file of bundle.files) {
  const targetPath = path.resolve(__dirname, '..', file.path);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, file.code, 'utf8');

  // Verify sha256
  const hash = crypto.createHash('sha256').update(file.code, 'utf8').digest('hex');
  if (hash !== file.sha256) {
    console.error(`Hash mismatch for ${file.path}: expected ${file.sha256}, got ${hash}`);
    process.exit(1);
  }
  console.log(`Verified & written: ${file.path}`);
}

// Find all sources/*.html?raw imports to see if any stubs are needed
const missingSources = new Set();
for (const file of bundle.files) {
  const matches = file.code.match(/sources\/[a-zA-Z0-9-]+\.html/g);
  if (matches) {
    for (const match of matches) {
      const sourceFile = path.resolve(__dirname, '..', 'src/shaders/neuform-isolated', match);
      if (!fs.existsSync(sourceFile)) {
        missingSources.add(sourceFile);
      }
    }
  }
}

console.log('\nMissing source files to stub for bundler compatibility:');
for (const missing of missingSources) {
  console.log('Stubbing:', missing);
  fs.mkdirSync(path.dirname(missing), { recursive: true });
  fs.writeFileSync(missing, '<!DOCTYPE html><html><body></body></html>', 'utf8');
}

console.log('\nUnpack complete and verified successfully!');
