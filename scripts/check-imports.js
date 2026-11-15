const fs = require('fs');
const path = require('path');

function walk(dir) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) res = res.concat(walk(p));
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) res.push(p);
  }
  return res;
}

const files = walk(path.join(__dirname, '../src/shaders'));
const externalPkgs = new Set();
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const matches = text.match(/from\s+['"]([^./][^'"]*)['"]/g);
  if (matches) {
    for (const m of matches) {
      const pkg = m.replace(/from\s+['"]/, '').replace(/['"]$/, '');
      externalPkgs.add(pkg);
    }
  }
}
console.log('External packages imported:', Array.from(externalPkgs));
