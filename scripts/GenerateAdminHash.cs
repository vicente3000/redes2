#:sdk Microsoft.NET.Sdk.Web
using Microsoft.AspNetCore.Identity;

Console.Error.Write("Contraseña del administrador: ");
var password = new System.Text.StringBuilder();
for (var key = Console.ReadKey(true); key.Key != ConsoleKey.Enter; key = Console.ReadKey(true))
{
    if (key.Key == ConsoleKey.Backspace && password.Length > 0) password.Length--;
    else if (!char.IsControl(key.KeyChar)) password.Append(key.KeyChar);
}
Console.Error.WriteLine();
if (password.Length is < 12 or > 256)
{
    Console.Error.WriteLine("Escribe entre 12 y 256 caracteres.");
    return 1;
}
Console.WriteLine(new PasswordHasher<string>().HashPassword(args.FirstOrDefault() ?? "admin", password.ToString()));
return 0;
