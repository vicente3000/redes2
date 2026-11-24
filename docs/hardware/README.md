# Montaje y compilación del ESP32

Configuración propuesta para ESP32 Dev Module clásico. Ajusta pines e intervalos en `firmware/include/Config.h`. ADC1 permanece disponible con el WiFi activo.

| Componente | Señal | GPIO | Montaje propuesto |
|---|---|---:|---|
| DHT11 | Datos | 4 | Alimentación de 3,3 V según módulo. Resistencia pull-up de 4,7–10 kΩ a 3,3 V si no viene incorporada. |
| LDR | Punto medio del divisor | 34 | LDR a 3,3 V y resistencia de 10 kΩ a tierra. |
| Sensor gas | Salida analógica | 35 | Usar módulo compatible y acondicionar la salida para que nunca supere 3,3 V. |
| LCD 1602 I2C | SDA / SCL | 21 / 22 | Dirección propuesta 0x27. Usa 0x3F si lo indica el escáner I2C. |
| Buzzer activo | Control | 25 | Conmutar con transistor o módulo compatible con lógica de 3,3 V. Activo en alto. |

Une las tierras. Si el adaptador I2C del LCD usa pull-ups a 5 V, instala un traductor bidireccional. Para un zumbador inductivo usa la protección indicada por su fabricante. Confirma voltaje, calentamiento y corriente del sensor de gas con su hoja de datos. El umbral en ADC es configurable y requiere ajuste experimental; las lecturas no se convierten a ppm.

El enunciado pide un banco de 8 V con dos pilas de 4 V y regulación a 5 V para los servicios 2–4. Comprueba polaridad y tensión de salida con multímetro antes de conectar. Alimenta por la entrada de 5 V admitida por la placa, dimensiona el regulador para el consumo del ESP32 y periféricos, incluyendo el calentador del sensor de gas, y mide bajo carga. Evita alimentar la placa por USB y por la fuente externa simultáneamente salvo que la placa lo admita.

## Compilación y carga

Instala PlatformIO Core. Copia `firmware/include/local_config.example.h` a `firmware/include/local_config.h` y completa las claves locales. Usa una clave WPA2 de 8 a 63 caracteres para el AP del servicio 2. En `MONITOR_URL` escribe la URL HTTP de IIS sin barra final.

```powershell
pio run -d firmware
pio run -d firmware -e servicio-2 -t upload
pio device monitor -b 115200
```

Cambia el entorno a `servicio-3` o `servicio-4` y especifica `--upload-port COMx` si hay varias placas. El servicio 2 imprime la IP del AP. El servicio 3 imprime la IP que entrega DHCP y reintenta al perder conexión. El servicio 4 informa los códigos HTTP y usa timeouts acotados. Si el servidor deja de responder, el buzzer conserva la última orden válida hasta recibir otra o reiniciarse.

## Un solo firmware para los servicios 2, 3 y 4

Compila y carga el perfil combinado con `pio run -d firmware -e taller-completo -t upload`. Abre el monitor serie a 115200 y envía `2`, `3` o `4`. La placa guarda la selección en su memoria y reinicia en ese modo. Envía `?` para conocer el modo actual. En el primer arranque selecciona el servicio 2 si aún no hay un modo guardado.

Los sitios del servicio 1 y el dashboard del servicio 4 se publican en IIS. En el modo 4 la placa consulta y alimenta ese servidor mediante HTTP.
