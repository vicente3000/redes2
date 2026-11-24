import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chartData, connectionLabel, fields } from '../software/servicio-4/backend/wwwroot/view.mjs';

test('el estado distingue desconexión, caducidad y simulación', () => {
    assert.match(connectionLabel(null, 'device'), /sin respuesta/);
    assert.match(connectionLabel({ reading: {} , stale: true }, 'device'), /desactualizados/);
    assert.match(connectionLabel({ reading: {}, stale: false }, 'simulator'), /Simulación .* recientes/);
});

test('historial conserva los huecos del DHT y admite un valor constante', () => {
    const receivedAt = '2026-11-24T14:00:00Z';
    const { points, min, max } = chartData([{ receivedAt, temperature: null }, { receivedAt, temperature: 23 }], 'temperature');
    assert.equal(points[0].value, null);
    assert.equal(points[1].time, Date.parse(receivedAt));
    assert.ok(min < 23 && max > 23);
});

test('el dashboard incluye las cuatro lecturas y programa su actualización', () => {
    const root = new URL('../software/servicio-4/backend/wwwroot/', import.meta.url);
    const html = readFileSync(new URL('index.html', root), 'utf8');
    const script = readFileSync(new URL('dashboard.mjs', root), 'utf8');
    for (const key of Object.keys(fields)) assert.match(html, new RegExp('id="' + key + '"'));
    assert.match(html, /id="controls" hidden/);
    assert.match(script, /setInterval\(refresh, 30000\)/);
});

