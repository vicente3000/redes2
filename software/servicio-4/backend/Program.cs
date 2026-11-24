using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
var data = config["Monitor:DataDirectory"] ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data");
Directory.CreateDirectory(data);
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(data, "keys")))
    .SetApplicationName("TallerWiFi");
builder.Services.AddProblemDetails();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "TallerWiFi.Session";
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = config.GetValue("Monitor:AllowHttpLogin", false)
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromHours(2);
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorizationBuilder().AddPolicy("Admin", policy => policy.RequireRole("Administrator"));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("Login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});
var app = builder.Build();
var store = new MonitorStore(data);
var admin = config["Monitor:AdminUser"] ?? "admin";
var hash = config["Monitor:AdminHash"];
var hasher = new PasswordHasher<string>();
var gasThreshold = Math.Clamp(config.GetValue("Monitor:GasThreshold", 3000), 0, 4095);
var staleAfter = Math.Max(1, config.GetValue("Monitor:StaleSeconds", 75));

app.UseExceptionHandler();
app.UseDefaultFiles();
app.UseStaticFiles();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "no-store";
    await next(context);
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api");
api.MapGet("/health", () => Results.Ok(new { status = "ok" }));
api.MapPost("/sensors", (Telemetry input, HttpContext context) =>
{
    if (!input.IsValid())
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["telemetry"] = ["Indique source, gas y luminosidad válidos. Temperatura y humedad admiten null por fallo del DHT11."]
        });
    var reading = store.Add(input);
    app.Logger.LogInformation("Telemetría {Source} recibida a {At}", input.Source, reading.ReceivedAt);
    return Results.Created(context.Request.PathBase + "/api/sensors/latest?source=" + input.Source, reading);
});
api.MapGet("/sensors/latest", (string? source) =>
{
    if (!Telemetry.ValidSource(source ?? "device")) return Results.BadRequest();
    var reading = store.History(source ?? "device").LastOrDefault();
    return Results.Ok(new
    {
        reading,
        stale = reading is null || DateTimeOffset.UtcNow - reading.ReceivedAt > TimeSpan.FromSeconds(staleAfter),
        gasWarning = reading?.Gas >= gasThreshold,
        gasThreshold
    });
});
api.MapGet("/sensors/history", (string? source, int? limit) =>
    Telemetry.ValidSource(source ?? "device") && limit is null or >= 1 and <= 240
        ? Results.Ok(new { readings = store.History(source ?? "device").TakeLast(limit ?? 60) })
        : Results.BadRequest());
api.MapGet("/alarm", (string? source) => Telemetry.ValidSource(source ?? "device")
    ? Results.Ok(new { active = store.Alarm(source ?? "device") })
    : Results.BadRequest());
api.MapGet("/alarm/events", (string? source) => Telemetry.ValidSource(source ?? "device")
    ? Results.Ok(new { events = store.Events(source ?? "device") })
    : Results.BadRequest()).RequireAuthorization("Admin");
foreach (var (route, active) in new[] { ("activate", true), ("deactivate", false) })
{
    api.MapPost("/alarm/" + route, (HttpContext context, string? source) =>
    {
        if (!Telemetry.ValidSource(source ?? "device") || !context.Request.HasJsonContentType())
            return Results.BadRequest();
        var changed = store.SetAlarm(source ?? "device", active, context.User.Identity!.Name!);
        if (changed) app.Logger.LogInformation("Alarma {Source}: {Active}, por {User}", source ?? "device", active, context.User.Identity!.Name);
        return Results.Ok(new { active });
    }).RequireAuthorization("Admin");
}

api.MapGet("/auth/session", (ClaimsPrincipal user) => Results.Ok(new { isAdmin = user.IsInRole("Administrator") }));
api.MapPost("/auth/login", async (Login credentials, HttpContext context) =>
{
    if (!context.Request.IsHttps && !config.GetValue("Monitor:AllowHttpLogin", false))
        return Results.StatusCode(403);
    if (string.IsNullOrWhiteSpace(hash)) return Results.StatusCode(503);
    if (credentials.Username != admin || string.IsNullOrEmpty(credentials.Password) ||
        credentials.Password.Length > 256 ||
        hasher.VerifyHashedPassword(admin, hash, credentials.Password) == PasswordVerificationResult.Failed)
        return Results.Unauthorized();
    var identity = new ClaimsIdentity(
        [new(ClaimTypes.Name, admin), new(ClaimTypes.Role, "Administrator")],
        CookieAuthenticationDefaults.AuthenticationScheme);
    await context.SignInAsync(new ClaimsPrincipal(identity));
    return Results.Ok(new { isAdmin = true });
}).RequireRateLimiting("Login");
api.MapPost("/auth/logout", async (HttpContext context) =>
{
    if (!context.Request.HasJsonContentType()) return Results.BadRequest();
    await context.SignOutAsync();
    return Results.NoContent();
}).RequireAuthorization("Admin");
app.Run();

record Login(string? Username, string? Password);
