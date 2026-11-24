import { fields, connectionLabel, chartData } from './view.mjs';

const el = id => document.getElementById(id);
let history = [];
let generation = 0;
let isAdmin = false;

async function request(path, body) {
    const options = body === undefined ? {} : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
    const response = await fetch('api/' + path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.status === 204 ? null : response.json();
}

function forSource(path, source = el('source').value) {
    return path + '?source=' + encodeURIComponent(source);
}

const date = value => new Date(value).toLocaleString('es-CL');

function draw() {
    const metric = el('metric').value;
    const canvas = el('chart');
    const ctx = canvas.getContext('2d');
    const { points, min, max } = chartData(history, metric);
    const left = 64, right = canvas.width - 26, top = 26, bottom = canvas.height - 42;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const available = points.filter(point => point.value !== null);
    el('chartInfo').textContent = available.length
        ? available.length + ' lecturas · ' + date(available[0].receivedAt) + ' – ' + date(available.at(-1).receivedAt)
        : 'Sin lecturas para este sensor';
    if (!available.length) return;
    ctx.font = '15px system-ui';
    ctx.fillStyle = '#526d61';
    ctx.strokeStyle = '#c9d8cc';
    for (let i = 0; i <= 4; i++) {
        const y = top + (bottom - top) * i / 4;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
        ctx.fillText(String(Math.round((max - (max - min) * i / 4) * 10) / 10), 4, y + 5);
    }
    const start = points[0].time;
    const span = points.at(-1).time - start;
    const x = point => span ? left + (right - left) * (point.time - start) / span : (left + right) / 2;
    const y = point => bottom - (bottom - top) * (point.value - min) / (max - min);
    ctx.strokeStyle = ctx.fillStyle = '#246443';
    ctx.lineWidth = 2;
    let previous = null;
    for (const point of points) {
        if (point.value === null) { previous = null; continue; }
        if (previous && point.time - previous.time <= 75000) {
            ctx.beginPath();
            ctx.moveTo(x(previous), y(previous));
            ctx.lineTo(x(point), y(point));
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x(point), y(point), 2.5, 0, 2 * Math.PI);
        ctx.fill();
        previous = point;
    }
    ctx.fillText(fields[metric].unit, left, canvas.height - 12);
}

function renderTelemetry(latest) {
    const reading = latest?.reading;
    el('connection').textContent = connectionLabel(latest, el('source').value);
    el('connection').classList.toggle('warning', !latest || latest.stale);
    el('updated').textContent = reading ? 'Último dato · ' + date(reading.receivedAt) : 'Sin actualización';
    for (const key of Object.keys(fields)) el(key).textContent = reading?.[key] ?? '—';
    const notice = el('gasNotice');
    notice.textContent = !reading ? 'Sin lectura de gas' : latest.gasWarning
        ? (latest.stale ? 'Última lectura elevada' : 'Advertencia de gas') + ' · umbral ' + latest.gasThreshold + ' ADC'
        : 'Última lectura bajo el umbral de ' + latest.gasThreshold + ' ADC';
    notice.classList.toggle('warning', latest?.gasWarning === true);
}

function renderAlarm(alarm) {
    el('alarm').textContent = alarm ? (alarm.active ? 'Activada' : 'Desactivada') : 'Estado sin confirmar';
    el('alarm').classList.toggle('warning', alarm?.active === true);
    for (const button of document.querySelectorAll('.buttons button')) {
        button.disabled = !alarm || alarm.active === (button.dataset.command === 'activate');
    }
}

async function refresh() {
    const version = ++generation;
    const source = el('source').value;
    const [latest, samples, alarm, session] = await Promise.allSettled([
        request(forSource('sensors/latest', source)), request(forSource('sensors/history', source)),
        request(forSource('alarm', source)), request('auth/session')
    ]);
    if (version !== generation) return;
    renderTelemetry(latest.value);
    renderAlarm(alarm.value);
    history = samples.value?.readings ?? [];
    draw();
    isAdmin = session.value?.isAdmin === true;
    el('controls').hidden = !isAdmin;
    el('login').hidden = isAdmin;
    el('events').replaceChildren();
    if (!isAdmin) return;
    try {
        const { events } = await request(forSource('alarm/events', source));
        if (version !== generation) return;
        for (const event of events) {
            const item = document.createElement('li');
            item.textContent = date(event.at) + ' · ' + event.user + ' · ' + (event.active ? 'Activó' : 'Desactivó');
            el('events').append(item);
        }
    } catch {
        if (version === generation) el('events').textContent = 'Historial de alarma no disponible';
    }
}

el('source').addEventListener('change', () => {
    renderTelemetry(null);
    renderAlarm(null);
    history = [];
    el('events').replaceChildren();
    draw();
    refresh();
});
el('metric').addEventListener('change', draw);
el('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
        await request('auth/login', Object.fromEntries(new FormData(form)));
        form.reset();
        el('login').open = false;
        el('actionStatus').textContent = 'Sesión iniciada';
        await refresh();
    } catch (error) {
        el('actionStatus').textContent = 'No se pudo iniciar sesión (' + error.message + ')';
    }
});
el('controls').addEventListener('click', async event => {
    const command = event.target.dataset.command;
    if (!command || !isAdmin) return;
    try {
        await request(command === 'logout' ? 'auth/logout' : forSource('alarm/' + command), {});
        el('actionStatus').textContent = command === 'logout' ? 'Sesión cerrada' : 'Orden de alarma guardada';
    } catch (error) {
        el('actionStatus').textContent = 'No se guardó la orden (' + error.message + ')';
    }
    await refresh();
});
refresh();
setInterval(refresh, 30000);

