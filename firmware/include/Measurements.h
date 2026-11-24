#pragma once
#include <Arduino.h>

struct Measurements {
    float temperature = NAN;
    float humidity = NAN;
    int light = 0;
    int gas = 0;
    bool ready = false;
};

Measurements readMeasurements();
void beginMeasurements();
void showMeasurements(const Measurements& data);
String encodeMeasurements(const Measurements& data, bool remote);

