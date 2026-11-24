# Taller II de Tecnología WiFi

| Servicio | Implementación | Acceso de ejemplo |
|---|---|---|
| 1 | [Dos sitios IIS](software/servicio-1) en la red de infraestructura | PC IIS en puertos 8080 y 8081 |
| 2 | ESP32 como AP con DHT11, LDR, LCD y servidor web | http://192.168.4.1 |
| 3 | ESP32 como estación con los mismos sensores y servidor web | IP impresa por el monitor serial |
| 4 | ESP32 como estación, sensor de gas, API IIS, dashboard y buzzer | IIS en puertos 8082 y 443 |

- [Arquitectura y diagramas](docs/architecture/README.md)
- [Conexiones, alimentación y firmware](docs/hardware/README.md)
- [Configuración del AP, IIS y firewall](docs/deployment/README.md)
- [Pruebas y matriz de cumplimiento](docs/evidence/README.md)

## Demostración local

Con SDK .NET 10, Node.js 22 o posterior y PowerShell 7, desde la raíz:

```powershell
$env:Monitor__AdminHash = dotnet run --file scripts/GenerateAdminHash.cs
$env:Monitor__AllowHttpLogin = 'true'
dotnet run --project software/servicio-4/backend --urls http://127.0.0.1:5080
```

El generador pide la contraseña sin eco. En otra terminal, inicia el simulador:

```powershell
node scripts/simulator.mjs --url http://127.0.0.1:5080 --high-gas --offline-after 2 --offline-seconds 90
```

Abre http://127.0.0.1:5080, selecciona **Simulación** y observa las lecturas. Inicia sesión con el usuario `admin` y la contraseña elegida. El aviso de gas se rige por el umbral ADC configurado. La orden manual de alarma de la simulación tiene su propio estado e historial.
