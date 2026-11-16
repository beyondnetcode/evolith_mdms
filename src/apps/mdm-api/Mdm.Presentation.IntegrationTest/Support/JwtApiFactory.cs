using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Tokens;
using Mdm.Application.Organization.Abstractions;

namespace Mdm.Presentation.IntegrationTest.Support;

/// <summary>
/// API con la validación JWT REAL (RS256, emisor, audiencia, <c>kid</c>) contra un JWKS estático con un par de
/// claves efímero generado en el arranque (ADR-0157 §6: ninguna clave versionada). Almacén de lectura falso:
/// sin base de datos.
/// </summary>
public sealed class JwtApiFactory : WebApplicationFactory<Program>
{
    public const string Issuer = TestJwtIssuer.Issuer;
    public const string Audience = TestJwtIssuer.Audience;
    public const string KeyId = TestJwtIssuer.KeyId;

    private readonly TestJwtIssuer _issuer = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<ITenantReadStore>();
            services.AddScoped<ITenantReadStore, FakeTenantReadStore>();
            services.RemoveAll<IConfigurationManager<JsonWebKeySet>>();
            services.AddSingleton(_issuer.CreateJwksManager());
        });
    }

    /// <summary>Emite un portador firmado con la clave de prueba; los parámetros permiten fabricar tokens inválidos.</summary>
    public string IssueToken(string audience = Audience, string? keyId = KeyId, string subject = "usuario-de-prueba") =>
        _issuer.IssueToken(audience, keyId, subject);

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _issuer.Dispose();
        }

        base.Dispose(disposing);
    }
}
