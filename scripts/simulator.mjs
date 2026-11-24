import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const { values } = parseArgs({ options: {
    url: { type: 'string', default: 'http://localhost:5080' },
    'high-gas': { type: 'boolean' },
    'offline-after': { type: 'string' },
    'offline-seconds': { type: 'string', default: '90' },
    'interval-seconds': { type: 'string', default: '30' },
    once: { type: 'boolean' }
} });
const interval = Number(values['interval-seconds']);
const offlineAfter = values['offline-after'] === undefined ? Infinity : Number(values['offline-after']);
const offlineSeconds = Number(values['offline-seconds']);
if (!Number.isSafeInteger(interval) || interval < 1 || interval > 3600 ||
    (offlineAfter !== Infinity && (!Number.isSafeInteger(offlineAfter) || offlineAfter < 1)) ||
    !Number.isSafeInteger(offlineSeconds) || offlineSeconds < 1 || offlineSeconds > 3600)
    throw new Error('Intervalo o parámetros de desconexión inválidos');

const base = new URL(values.url.replace(/\/$/, '') + '/');
const simulate = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
async function call(path, payload) {
    const options = payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) } : {};
    const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(path + ' HTTP ' + response.status);
    return response.json();
}

let cycles = 0;
let lastPost = -Infinity;
while (true) {
    if (cycles === offlineAfter && Date.now() - lastPost >= interval * 1000) {
        console.log('[SIMULACIÓN] Sin conexión durante ' + offlineSeconds + ' s');
        await delay(offlineSeconds * 1000);
        console.log('[SIMULACIÓN] Conexión recuperada');
        cycles++;
    }
    if (Date.now() - lastPost >= interval * 1000) {
        lastPost = Date.now();
        const payload = { source: 'simulator', temperature: simulate(19, 30), humidity: simulate(35, 67),
            light: simulate(700, 2800), gas: values['high-gas'] ? 4095 : simulate(300, 1300) };
        try {
            await call('api/sensors', payload);
            console.log('[SIMULACIÓN] Telemetría aceptada', payload);
            cycles++;
        } catch (error) {
            console.error('[SIMULACIÓN] ' + error.message);
            if (values.once) process.exit(1);
        }
    }
    try {
        const alarm = await call('api/alarm?source=simulator');
        console.log('[SIMULACIÓN] Buzzer ' + (alarm.active ? 'encendido' : 'apagado'));
    } catch (error) {
        console.error('[SIMULACIÓN] ' + error.message);
        if (values.once) process.exit(1);
    }
    if (values.once) break;
    await delay(Math.min(interval, 5) * 1000);
}
