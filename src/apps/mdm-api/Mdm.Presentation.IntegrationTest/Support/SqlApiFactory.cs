using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Tokens;

namespace Mdm.Presentation.IntegrationTest.Support;

/// <summary>
/// API completa: almacén de lectura y repositorio REALES contra SQL Server, y validación JWT real contra el
/// JWKS estático del emisor de prueba. Solo se sustituyen la cadena de conexión y el gestor del JWKS.
/// </summary>
public sealed class SqlApiFactory(string connectionString, TestJwtIssuer issuer) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
            new Dictionary<string, string?> { ["ConnectionStrings:Mdm"] = connectionString }));
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IConfigurationManager<JsonWebKeySet>>();
            services.AddSingleton(issuer.CreateJwksManager());
        });
    }
}
