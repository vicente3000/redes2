#pragma once
constexpr char SensorPage[] PROGMEM = R"HTML(<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sensores ESP32</title>
<style>body{font:18px system-ui;background:#edf5ef;color:#17382c;max-width:42rem;margin:6vh auto;padding:1rem}dl{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}dl div{background:white;padding:1rem;border-top:4px solid #38765b}dd{margin:.5rem 0;font-size:1.5rem;font-weight:bold}</style>
<main><h1>Sensores ESP32</h1><dl><div><dt>Temperatura</dt><dd id="temperature">—</dd></div><div><dt>Humedad</dt><dd id="humidity">—</dd></div><div><dt>Luminosidad</dt><dd id="light">—</dd></div></dl><p id="status" role="status"></p></main>
<script>
const fields={temperature:' °C',humidity:' %',light:' ADC'};
const statusText=document.querySelector('#status');
async function update(){
 try{
   const response=await fetch('/api/sensors',{cache:'no-store'});
   if(!response.ok) throw Error();
   const sample=await response.json();
   for(const [key,unit] of Object.entries(fields)) document.getElementById(key).textContent=sample[key]==null?'Sin lectura':sample[key]+unit;
   statusText.textContent=sample.temperature==null||sample.humidity==null?'DHT11 sin lectura':'Actualizado '+new Date().toLocaleTimeString();
 }catch{statusText.textContent='Sin datos nuevos. Se reintentará.';}
 finally{setTimeout(update,3000);}
}
update();
</script></html>)HTML";
