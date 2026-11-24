const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
for (const site of ['red', 'diagnostico']) {
  test('Página IIS: ' + site, () => {
    const file = 'software/servicio-1/' + site + '/index.html';
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /name="viewport"/);
    assert.match(html, /lang="es"/);
    assert.match(html, /<main/);
  });
}

