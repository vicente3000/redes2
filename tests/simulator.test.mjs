import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('el simulador publica gas elevado y aísla el sondeo durante un corte', async t => {
    const requests = [];
    const server = createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        requests.push({ method: req.method, url: req.url, body, at: Date.now() });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ active: true }));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => { server.close(); });
    const args = ['scripts/simulator.mjs', '--url', 'http://127.0.0.1:' + server.address().port, '--high-gas'];
    const run = promisify(execFile);
    const { stdout } = await run(process.execPath, [...args, '--once'], { timeout: 8000 });
    assert.match(stdout, /Buzzer encendido/);
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].url, '/api/sensors');
    const payload = JSON.parse(requests[0].body);
    assert.equal(payload.source, 'simulator');
    assert.equal(payload.gas, 4095);
    assert.equal(requests[1].url, '/api/alarm?source=simulator');

    requests.length = 0;
    const child = execFile(process.execPath, [...args, '--offline-after', '1', '--offline-seconds', '2',
        '--interval-seconds', '1'], { timeout: 8000 });
    t.after(() => { child.kill(); });
    await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', () => requests.filter(r => r.method === 'POST').length >= 2
            ? resolve() : reject(new Error('El simulador no recuperó la conexión')));
        child.stdout.on('data', () => {
            if (requests.filter(r => r.method === 'POST').length >= 2) child.kill();
        });
    });
    const posts = requests.filter(r => r.method === 'POST');
    assert.ok(posts[1].at - posts[0].at >= 2800);
    const pollsDuringCut = requests.filter(r => r.method === 'GET' && r.at > posts[0].at + 1000 && r.at < posts[1].at);
    assert.equal(pollsDuringCut.length, 0);
});
