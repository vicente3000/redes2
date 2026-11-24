# Verificación del taller

## Resultados de software

Se ejecutaron seis pruebas Node.js con éxito, incluida una interrupción simulada y su recuperación mediante HTTP local. El backend compiló con .NET SDK 10.0.100 sin errores ni advertencias. La publicación Release generó el archivo de configuración para IIS y se probó mediante el servidor local de ASP.NET Core. La integración aprobó telemetría, validación, historial, autenticación, auditoría, cambios de alarma, caducidad y recuperación. También se verificó el envío del simulador al backend publicado y la entrega del dashboard y su módulo JavaScript.

## Pruebas automatizadas

Desde la raíz, ejecuta `node --test tests/*.test.*` en Node.js 22 o posterior. La suite comprueba los sitios estáticos, la presentación de datos recientes y caducados, los huecos del historial, el intervalo del dashboard y el tráfico HTTP del simulador con un servidor de prueba local.

Con una instancia nueva de la API y un hash para el usuario `admin`, ejecuta el siguiente comando en PowerShell 7. Usa una carpeta de datos de prueba vacía para que el estado de alarma inicial sea desactivado.

```powershell
$testPassword = Read-Host 'Contraseña de la instancia de pruebas'
./tests/api.ps1 -Base http://127.0.0.1:5080 -Password $testPassword
```

## Demostración con hardware e IIS

1. Desde un PC y teléfono abre ambos sitios estáticos al conectarte a `TallerRedesII`.
2. Con el perfil 2, conéctate al AP del ESP32. Abre la página y el JSON. Sombrea el LDR y compara LCD y navegador. Desconecta la señal DHT11 y verifica el error.
3. Cambia al perfil 3. Abre la IP serial desde otro equipo. Apaga y vuelve a encender el AP. Comprueba que el ESP32 obtiene IP y que vuelve a publicar.
4. Con el perfil 4, verifica un POST aproximadamente cada 30 s y observa las cuatro tarjetas. Comprueba que un visitante ve los datos y no tiene controles de alarma. Entra como administrador y verifica encendido, apagado y eventos.
5. Ejecuta el simulador con `--high-gas --offline-after 2 --offline-seconds 90`. Selecciona **Simulación**. Verifica advertencia de gas con alarma desactivada. Tras 75 s de la última muestra observa datos desactualizados y espera la recuperación.
6. Registra IP, fecha, captura del dashboard, códigos HTTP, observaciones del LCD y medición de 5 V bajo carga.

## Matriz de cumplimiento

| Requisito | Evidencia de software | Verificación de montaje |
|---|---|---|
| AP externo, dos sitios IIS y clientes móviles | Sitios responsivos y guía de bindings/firewall | Configurar AP, publicar y probar acceso LAN |
| ESP32 AP, DHT11, LDR, LCD e interfaz web | Perfil 2, página con sondeo y JSON GET | Probar LCD, ADC, DHT11 y clientes |
| ESP32 estación y recuperación | Perfil 3 comparte módulos y reintenta WiFi | Cortar y recuperar el AP externo |
| Gas, envío periódico y buzzer | Perfil 4, POST cada 30 s y GET cada 5 s | Verificar sensor y buzzer físico |
| Dashboard, historial, roles y alarma manual | API, frontend, auditoría y guion de integración | Publicar en IIS y comprobar HTTPS |
| Simulación y datos caducados | Cliente CLI y suite Node.js | Demostración con API y navegador |
| Fuente autónoma | Tabla de conexiones y guía de regulación | Medir tensión y autonomía bajo carga |

El umbral de gas se expresa en ADC. La calibración y los resultados físicos se registran al ejecutar el montaje.
