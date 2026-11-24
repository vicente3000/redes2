using System.Text.Json;

record Telemetry(decimal? Temperature, decimal? Humidity, int? Light, int? Gas, string? Source)
{
    public static bool ValidSource(string? source) => source is "device" or "simulator";
    public bool IsValid() => ValidSource(Source) && Light is >= 0 and <= 4095 && Gas is >= 0 and <= 4095
        && (Temperature is null or >= -40 and <= 85) && (Humidity is null or >= 0 and <= 100);
}

record Reading(decimal? Temperature, decimal? Humidity, int Light, int Gas, DateTimeOffset ReceivedAt);
record AlarmEvent(bool Active, string User, DateTimeOffset At);

sealed class MonitorStore(string directory)
{
    private readonly object gate = new();
    private readonly Dictionary<string, List<Reading>> readings = new()
    {
        ["device"] = Load<Reading>(directory, "readings-device"),
        ["simulator"] = Load<Reading>(directory, "readings-simulator")
    };
    private readonly Dictionary<string, List<AlarmEvent>> events = new()
    {
        ["device"] = Load<AlarmEvent>(directory, "alarm-device"),
        ["simulator"] = Load<AlarmEvent>(directory, "alarm-simulator")
    };

    public Reading Add(Telemetry input)
    {
        lock (gate)
        {
            var reading = new Reading(input.Temperature, input.Humidity, input.Light!.Value, input.Gas!.Value, DateTimeOffset.UtcNow);
            var source = input.Source!;
            readings[source] = Save("readings-" + source, readings[source], reading, 2880);
            return reading;
        }
    }

    public Reading[] History(string source)
    {
        lock (gate) return readings[source].TakeLast(240).ToArray();
    }

    public AlarmEvent[] Events(string source)
    {
        lock (gate) return events[source].TakeLast(100).Reverse().ToArray();
    }

    public bool Alarm(string source)
    {
        lock (gate) return events[source].LastOrDefault()?.Active ?? false;
    }

    public bool SetAlarm(string source, bool active, string user)
    {
        lock (gate)
        {
            if ((events[source].LastOrDefault()?.Active ?? false) == active) return false;
            events[source] = Save("alarm-" + source, events[source], new AlarmEvent(active, user, DateTimeOffset.UtcNow), 500);
            return true;
        }
    }

    private List<T> Save<T>(string name, List<T> items, T item, int limit)
    {
        var updated = items.TakeLast(limit - 1).Append(item).ToList();
        var path = Path.Combine(directory, name + ".json");
        File.WriteAllText(path + ".tmp", JsonSerializer.Serialize(updated));
        File.Move(path + ".tmp", path, overwrite: true);
        return updated;
    }

    private static List<T> Load<T>(string directory, string name)
    {
        var path = Path.Combine(directory, name + ".json");
        return File.Exists(path) ? JsonSerializer.Deserialize<List<T>>(File.ReadAllText(path)) ?? [] : [];
    }
}
