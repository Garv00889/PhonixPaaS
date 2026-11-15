const fs = require('fs');
const content = fs.readFileSync('src/shaders/neuform-isolated/sources/signal-particles.html', 'utf8');
const target = 'ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;';
console.log('Includes target:', content.includes(target));
const idx = content.indexOf('148, 163, 184');
console.log('Found around:', JSON.stringify(content.slice(idx - 40, idx + 60)));
