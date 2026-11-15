const fs = require('fs');
const content = fs.readFileSync('public/landing.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('<body') || l.includes('rd-hero')) {
    console.log(i + 1, l);
  }
});
