export const fields = {
    temperature: { unit: '°C' },
    humidity: { unit: '%' },
    light: { unit: 'ADC' },
    gas: { unit: 'ADC' }
};

export function connectionLabel(latest, source) {
    const device = source === 'simulator' ? 'Simulación' : 'ESP32';
    if (!latest) return device + ' · servidor sin respuesta';
    if (!latest.reading) return device + ' · sin datos';
    return device + (latest.stale ? ' · datos desactualizados' : ' · datos recientes');
}

export function chartData(history, metric) {
    const points = history.map(reading => ({ receivedAt: reading.receivedAt,
        time: Date.parse(reading.receivedAt), value: reading[metric] }));
    const values = points.map(point => point.value).filter(Number.isFinite);
    if (!values.length) return { points, min: 0, max: 1 };
    const min = Math.min(...values), max = Math.max(...values);
    return { points, min: min === max ? min - 1 : min, max: min === max ? max + 1 : max };
}
