const fs = require('fs');
const path = require('path');

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/#8a05ff/gi, '#ef233c');
  content = content.replace(/#8d3dd8/gi, '#d90429');
  content = content.replace(/#d59afc/gi, '#ff4d6d');
  content = content.replace(/rgba\(138,\s*5,\s*255/gi, 'rgba(239, 35, 60');
  content = content.replace(/rgba\(141,\s*61,\s*216/gi, 'rgba(217, 4, 41');
  content = content.replace(/rgba\(74,\s*5,\s*120/gi, 'rgba(141, 8, 1');
  content = content.replace(/rgba\(213,\s*154,\s*252/gi, 'rgba(255, 77, 109');
  content = content.replace(/--accent-purple/gi, '--accent-red');
  content = content.replace(/selection-purple/gi, 'selection-red');
  content = content.replace(/#120326/gi, '#1a0505');
  content = content.replace(/#0c0017/gi, '#1a0505');
  content = content.replace(/#06000c/gi, '#050202');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Converted:', filePath);
}

convertFile(path.join(__dirname, '..', 'public', 'index.html'));
convertFile(path.join(__dirname, '..', 'public', 'landing.html'));
convertFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
convertFile(path.join(__dirname, '..', 'public', 'login.html'));
convertFile(path.join(__dirname, '..', 'public', 'css', 'style.css'));
convertFile(path.join(__dirname, '..', 'public', 'js', 'app.js'));
