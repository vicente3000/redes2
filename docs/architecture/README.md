# Arquitectura del taller

Los servicios 2, 3 y 4 compilan las mismas fuentes con perfiles de PlatformIO. `Measurements` encapsula DHT11, ADC, LCD y JSON. `main.cpp` selecciona AP/STA y HTTP local o remoto. El dashboard vive en `wwwroot` para compartir origen con la API y publicarse en el mismo sitio IIS.

```mermaid
flowchart LR
  Phone["PC y teléfono"] --- AP["AP TallerRedesII 10.0.0.1"]
  AP --- IIS["PC Windows IIS 10.0.0.10"]
  AP --- S3["ESP32 STA · servicio 3"]
  AP --- S4["ESP32 STA · servicio 4"]
  Direct["Cliente del servicio 2"] --- S2["ESP32 AP 192.168.4.1"]
```

```mermaid
flowchart LR
  Sensors["DHT11, LDR y gas"] --> FW["Módulo de mediciones ESP32"]
  FW --> LCD["LCD I2C"]
  FW --> Web["Servidor local · servicios 2 y 3"]
  FW --> API["API ASP.NET Core · servicio 4"]
  API --> Storage["JSON local por origen"]
  API --> Dashboard["Dashboard público y panel de administrador"]
  Sim["Simulador Node.js"] --> API
  API --> Buzzer["Orden consultada por el ESP32"]
```

```mermaid
sequenceDiagram
  participant E as ESP32
  participant I as API en IIS
  participant V as Visitante
  participant A as Administrador
  E->>I: POST /api/sensors (cada 30 s)
  I-->>E: 201 con lectura fechada
  V->>I: GET /api/sensors/latest y history
  I-->>V: Lecturas y aviso ADC
  A->>I: POST /api/auth/login (HTTPS)
  I-->>A: Cookie de sesión
  A->>I: POST /api/alarm/activate
  I-->>A: 200 y evento registrado
  E->>I: GET /api/alarm (cada 5 s)
  I-->>E: active true
  Note over E: Enciende el buzzer
  A->>I: POST /api/alarm/deactivate
  E->>I: GET /api/alarm
  I-->>E: active false
```

En los servicios 2 y 3, el cliente abre `GET /` y la página consulta `GET /api/sensors` cada 3 s. El servidor entrega 503 hasta disponer de la primera muestra y usa `null` para lecturas fallidas del DHT11.

El servicio 4 separa lecturas, alarma y auditoría entre los orígenes `device` y `simulator`. La API persiste un máximo de 2880 mediciones y 500 eventos por origen. Los endpoints históricos exponen hasta 240 lecturas y 100 eventos. La frescura depende de la hora de recepción en el servidor. El estado de alarma representa la orden guardada, ya que el protocolo no incluye acuse del buzzer.
