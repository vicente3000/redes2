# Despliegue en la red del taller

## Access Point

1. Conecta un PC por cable o a la red actual del equipo. Abre `http://10.0.0.1` y usa las credenciales administrativas suministradas por el docente.
2. Configura SSID `TallerRedesII`, cifrado WPA2-Personal compatible con el ESP32 y la contraseña de laboratorio indicada en el enunciado. Conserva `10.0.0.1/24` como IP administrativa y cambia la contraseña administrativa de fábrica.
3. Habilita un único DHCP para la subred, por ejemplo desde `10.0.0.50` hasta `10.0.0.200`. Da al PC IIS una IP fija o reservada, por ejemplo `10.0.0.10`. Deshabilita aislamiento entre clientes para la red del taller.
4. Reconecta PC, teléfono y ESP32 de servicios 3 y 4 al nuevo SSID.

## IIS

1. Habilita IIS, **Static Content** y **Default Document** en Windows. Instala el Hosting Bundle de .NET 10 después de IIS. Si se instaló primero, repara el Hosting Bundle. Reinicia IIS.
2. Crea los sitios estáticos con raíz física en `software/servicio-1/red` y `software/servicio-1/diagnostico`, o en sus copias de publicación. Usa bindings HTTP en la IP de la LAN y puertos 8080 y 8081, respectivamente. Deja vacío el nombre de host. Verifica que `index.html` esté habilitado como documento predeterminado.
3. Publica el monitor con `dotnet publish software/servicio-4/backend -c Release -o C:/inetpub/taller-monitor`. El Web SDK genera `web.config`. Crea un sitio con esa raíz y un pool dedicado en **No Managed Code**, con un solo proceso. Desactiva el reciclaje superpuesto del pool para evitar escritores simultáneos en el almacenamiento local.
4. Define un binding HTTP en `10.0.0.10:8082` para el ESP32 y un binding HTTPS en el puerto 443 para el dashboard administrativo. Usa un certificado confiable para el nombre o IP que usarán los clientes. Habilita autenticación anónima en IIS porque ASP.NET Core verifica el rol.
5. Agrega al bloque `aspNetCore` del `web.config` publicado, en la máquina IIS, estas variables de entorno. Sustituye el hash por la salida de `dotnet run --file scripts/GenerateAdminHash.cs` y ajusta la ruta si corresponde.

```xml
<environmentVariables>
  <environmentVariable name="Monitor__DataDirectory" value="C:\TallerWiFiData" />
  <environmentVariable name="Monitor__AdminUser" value="admin" />
  <environmentVariable name="Monitor__AdminHash" value="HASH_GENERADO_LOCALMENTE" />
</environmentVariables>
```

Concede lectura al pool sobre la publicación y modificación sobre la carpeta de datos, con acceso restringido al pool y administradores. Conserva esa carpeta y sus claves al republicar. Por defecto el inicio de sesión requiere HTTPS. Ajustes adicionales: `Monitor__GasThreshold` (3000 ADC) y `Monitor__StaleSeconds` (75 s).

## Firewall y comprobación

En PowerShell como administrador, con la interfaz del taller en el perfil Privado:

```powershell
New-NetFirewallRule -DisplayName 'Taller WiFi IIS' -Direction Inbound -Action Allow -Profile Private -Protocol TCP -LocalPort 8080,8081,8082,443 -RemoteAddress 10.0.0.0/24
```

Desde otro PC, ejecuta `Test-NetConnection 10.0.0.10 -Port 8082`. En PC y teléfono abre los sitios estáticos y `http://10.0.0.10:8082/api/health`. Abre el dashboard por HTTPS para entrar como administrador. Ante error, revisa IP, binding y firewall. Un 503 en login indica que falta el hash de configuración. El servicio acepta telemetría HTTP en la LAN de laboratorio, por lo que el origen `device` identifica el canal declarado por el cliente.

[Guía oficial de publicación en IIS para ASP.NET Core 10](https://learn.microsoft.com/aspnet/core/host-and-deploy/iis/?view=aspnetcore-10.0)
