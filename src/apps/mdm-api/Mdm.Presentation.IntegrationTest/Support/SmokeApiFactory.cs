using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Mdm.Application.Organization.Abstractions;

namespace Mdm.Presentation.IntegrationTest.Support;

/// <summary>
/// Arranque de la API para las pruebas de humo: autenticación de prueba y almacén de lectura falso,
/// de modo que corren sin SQL Server ni Docker.
/// </summary>
public sealed class SmokeApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<ITenantReadStore>();
            services.AddScoped<ITenantReadStore, FakeTenantReadStore>();
            services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        });
    }
}
