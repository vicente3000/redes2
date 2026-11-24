#pragma once
#include <Arduino.h>

#if __has_include("local_config.h")
#include "local_config.h"
#else
#include "local_config.example.h"
#endif

namespace Config {
constexpr uint8_t dht = 4;
constexpr uint8_t light = 34;
constexpr uint8_t gas = 35;
constexpr uint8_t buzzer = 25;
constexpr uint8_t sda = 21;
constexpr uint8_t scl = 22;
constexpr uint8_t lcdAddress = 0x27;
constexpr uint32_t sampleMs = 2500;
constexpr uint32_t telemetryMs = 30000;
constexpr uint32_t alarmMs = 5000;
constexpr uint32_t retryMs = 15000;
}
