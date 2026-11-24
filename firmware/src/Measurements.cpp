#include <ArduinoJson.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>
#include "Config.h"
#include "Measurements.h"

namespace {
DHT dht(Config::dht, DHT11);
LiquidCrystal_I2C lcd(Config::lcdAddress, 16, 2);

void printLine(uint8_t row, const char* message) {
    lcd.setCursor(0, row);
    const size_t length = strlen(message);
    for (size_t i = 0; i < 16; ++i) lcd.print(i < length ? message[i] : ' ');
}
}

void beginMeasurements() {
    dht.begin();
    analogReadResolution(12);
    Wire.begin(Config::sda, Config::scl);
    lcd.init();
    lcd.backlight();
    printLine(0, "Midiendo...");
}

Measurements readMeasurements() {
    Measurements data;
    data.temperature = dht.readTemperature();
    data.humidity = dht.readHumidity();
    data.light = analogRead(Config::light);
#if SERVICE == 4
    data.gas = analogRead(Config::gas);
#endif
    data.ready = true;
    if (isnan(data.temperature) || isnan(data.humidity)) Serial.println("Error de lectura DHT11");
    return data;
}

void showMeasurements(const Measurements& data) {
    char line[32];
    if (isnan(data.temperature) || isnan(data.humidity)) {
        printLine(0, "DHT11 sin datos");
    } else {
        snprintf(line, sizeof(line), "T:%.0fC H:%.0f%%", data.temperature, data.humidity);
        printLine(0, line);
    }
#if SERVICE == 4
    snprintf(line, sizeof(line), "L:%d G:%d", data.light, data.gas);
#else
    snprintf(line, sizeof(line), "Luz:%d ADC", data.light);
#endif
    printLine(1, line);
}

String encodeMeasurements(const Measurements& data, bool remote) {
    JsonDocument doc;
    if (isfinite(data.temperature)) doc["temperature"] = data.temperature;
    else doc["temperature"] = nullptr;
    if (isfinite(data.humidity)) doc["humidity"] = data.humidity;
    else doc["humidity"] = nullptr;
    doc["light"] = data.light;
    if (remote) {
        doc["gas"] = data.gas;
        doc["source"] = "device";
    }
    String json;
    serializeJson(doc, json);
    return json;
}

