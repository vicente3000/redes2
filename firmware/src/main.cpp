#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <WiFi.h>
#include "Config.h"
#include "Measurements.h"
#include "SensorPage.h"

namespace {
Measurements latest;
uint32_t lastSample;
bool online = false;
#if SERVICE != 2
uint32_t lastRetry;
#endif
#if SERVICE == 4
uint32_t lastPost;
uint32_t lastPoll;
#else
WebServer server(80);
#endif

bool due(uint32_t& last, uint32_t interval) {
    const uint32_t now = millis();
    if (now - last < interval) return false;
    last = now;
    return true;
}

void updateNetwork() {
#if SERVICE != 2
    const bool connected = WiFi.status() == WL_CONNECTED;
    if (connected != online) {
        online = connected;
        if (online) {
            Serial.print("IP ESP32: ");
            Serial.println(WiFi.localIP());
#if SERVICE == 4
            lastPost = millis() - Config::telemetryMs;
            lastPoll = millis() - Config::alarmMs;
#endif
        } else {
            Serial.println("WiFi desconectado");
        }
    }
    if (!online && due(lastRetry, Config::retryMs)) {
        Serial.println("Reintentando WiFi");
        WiFi.reconnect();
    }
#endif
}

#if SERVICE == 4
void communicate(bool post) {
    WiFiClient client;
    HTTPClient http;
    const String url = String(MONITOR_URL) + (post ? "/api/sensors" : "/api/alarm?source=device");
    if (!http.begin(client, url)) {
        Serial.println("No se pudo iniciar HTTP");
        return;
    }
    http.setConnectTimeout(1200);
    http.setTimeout(1200);
    int code;
    if (post) {
        http.addHeader("Content-Type", "application/json");
        code = http.POST(encodeMeasurements(latest, true));
    } else {
        code = http.GET();
        if (code == 200) {
            JsonDocument response;
            if (!deserializeJson(response, http.getString()) && response["active"].is<bool>()) {
                digitalWrite(Config::buzzer, response["active"].as<bool>() ? HIGH : LOW);
            } else {
                Serial.println("Respuesta de alarma inválida");
            }
        }
    }
    Serial.printf("%s HTTP: %d\n", post ? "Telemetría" : "Alarma", code);
    http.end();
}
#endif
}

void setup() {
    Serial.begin(115200);
#if SERVICE == 4
    pinMode(Config::buzzer, OUTPUT);
    digitalWrite(Config::buzzer, LOW);
#endif
    beginMeasurements();
    lastSample = millis();

#if SERVICE == 2
    WiFi.mode(WIFI_AP);
    online = WiFi.softAP(AP_SSID, AP_PASSWORD);
    Serial.print(online ? "IP ESP32 AP: " : "Fallo al iniciar AP: ");
    Serial.println(WiFi.softAPIP());
#else
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(STATION_SSID, STATION_PASSWORD);
    lastRetry = millis();
#endif

#if SERVICE != 4
    server.on("/", HTTP_GET, [] { server.send_P(200, "text/html; charset=utf-8", SensorPage); });
    server.on("/api/sensors", HTTP_GET, [] {
        server.sendHeader("Cache-Control", "no-store");
        if (latest.ready) server.send(200, "application/json", encodeMeasurements(latest, false));
        else server.send(503, "application/json", "{\"status\":\"sampling\"}");
    });
    server.begin();
#endif
}

void loop() {
    updateNetwork();
    if (due(lastSample, Config::sampleMs)) {
        latest = readMeasurements();
        showMeasurements(latest);
    }
#if SERVICE == 4
    if (online && due(lastPoll, Config::alarmMs)) communicate(false);
    if (online && latest.ready && due(lastPost, Config::telemetryMs)) communicate(true);
#else
    if (online) server.handleClient();
#endif
}

