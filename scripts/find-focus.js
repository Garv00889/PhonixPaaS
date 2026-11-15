const fs = require('fs');
const content = fs.readFileSync('src/shaders/neuform-isolated/NeuformBatchEffects.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('role') || l.includes('target') || l.includes('isolate') || l.includes('focusCss')) {
    console.log(i + 1, l);
  }
});
