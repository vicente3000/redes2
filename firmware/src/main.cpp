#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include "Config.h"
#include "Measurements.h"
#include "SensorPage.h"

namespace {
uint8_t service = SERVICE == 0 ? 2 : SERVICE;
Measurements latest;
uint32_t lastSample;
bool online = false;
uint32_t lastRetry;
uint32_t lastPost;
uint32_t lastPoll;
WebServer server(80);

void selectService() {
#if SERVICE == 0
    if (!Serial.available()) return;
    const int key = Serial.read();
    if (key == '?') {
        Serial.printf("Servicio activo: %u. Pulsa 2, 3 o 4 para cambiarlo.\n", service);
        return;
    }
    if (key < '2' || key > '4' || key - '0' == service) return;
    Preferences settings;
    if (!settings.begin("taller", false) || settings.putUChar("service", key - '0') != 1) {
        Serial.println("No se pudo guardar el servicio");
        return;
    }
    settings.end();
    Serial.printf("Reiniciando en servicio %c\n", key);
    Serial.flush();
    ESP.restart();
#endif
}

bool due(uint32_t& last, uint32_t interval) {
    const uint32_t now = millis();
    if (now - last < interval) return false;
    last = now;
    return true;
}

void updateNetwork() {
    if (service == 2) return;
    const bool connected = WiFi.status() == WL_CONNECTED;
    if (connected != online) {
        online = connected;
        if (online) {
            Serial.print("IP ESP32: ");
            Serial.println(WiFi.localIP());
            lastPost = millis() - Config::telemetryMs;
            lastPoll = millis() - Config::alarmMs;
        } else {
            Serial.println("WiFi desconectado");
        }
    }
    if (!online && due(lastRetry, Config::retryMs)) {
        Serial.println("Reintentando WiFi");
        WiFi.reconnect();
    }
}

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
}

void setup() {
    Serial.begin(115200);
#if SERVICE == 0
    Preferences settings;
    if (settings.begin("taller", true)) {
        const uint8_t saved = settings.getUChar("service", 2);
        if (saved >= 2 && saved <= 4) service = saved;
        settings.end();
    }
    Serial.printf("Servicio activo: %u. Pulsa 2, 3 o 4 para cambiarlo.\n", service);
#endif
    pinMode(Config::buzzer, OUTPUT);
    digitalWrite(Config::buzzer, LOW);
    beginMeasurements();
    lastSample = millis();

    if (service == 2) {
        WiFi.mode(WIFI_AP);
        online = WiFi.softAP(AP_SSID, AP_PASSWORD);
        Serial.print(online ? "IP ESP32 AP: " : "Fallo al iniciar AP: ");
        Serial.println(WiFi.softAPIP());
    } else {
        WiFi.mode(WIFI_STA);
        WiFi.setAutoReconnect(true);
        WiFi.begin(STATION_SSID, STATION_PASSWORD);
        lastRetry = millis();
    }

    if (service != 4) {
        server.on("/", HTTP_GET, [] { server.send_P(200, "text/html; charset=utf-8", SensorPage); });
        server.on("/api/sensors", HTTP_GET, [] {
            server.sendHeader("Cache-Control", "no-store");
            if (latest.ready) server.send(200, "application/json", encodeMeasurements(latest, false));
            else server.send(503, "application/json", "{\"status\":\"sampling\"}");
        });
        server.begin();
    }
}

void loop() {
    selectService();
    updateNetwork();
    if (due(lastSample, Config::sampleMs)) {
        latest = readMeasurements(service == 4);
        showMeasurements(latest, service == 4);
    }
    if (!online) return;
    if (service == 4) {
        if (due(lastPoll, Config::alarmMs)) communicate(false);
        if (latest.ready && due(lastPost, Config::telemetryMs)) communicate(true);
    } else {
        server.handleClient();
    }
}
