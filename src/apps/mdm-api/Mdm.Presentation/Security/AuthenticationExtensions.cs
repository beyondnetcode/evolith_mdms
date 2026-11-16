using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Tokens;
using Mdm.Application.Common;

namespace Mdm.Presentation.Security;

/// <summary>Autenticación del portador RS256 de UMS y política por defecto «usuario autenticado» (ADR-0157, ADR-0230).</summary>
public static class AuthenticationExtensions
{
    /// <summary>
    /// Registra JwtBearer contra el JWKS configurado y exige usuario autenticado en todo endpoint que no
    /// declare lo contrario (<c>FallbackPolicy</c>). La autorización por permiso no existe aún (G-314).
    /// El gestor del JWKS se registra con <c>TryAdd</c>: una prueba puede sustituirlo.
    /// </summary>
    public static IServiceCollection AddMdmAuthentication(this IServiceCollection services, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(environment);

        services.AddOptions<AuthenticationSettings>()
            .BindConfiguration(AuthenticationSettings.SectionName)
            .Validate(s => s.Validate() is null, "Configuración de autenticación inválida; ver 'Authentication:*'.")
            .ValidateOnStart();

        services.TryAddSingleton<IConfigurationManager<JsonWebKeySet>>(sp => CreateJwksManager(
            sp.GetRequiredService<IOptions<AuthenticationSettings>>().Value.Jwks,
            environment.IsDevelopment()));
        services.TryAddSingleton<JwksSigningKeyResolver>();
        services.AddSingleton<IConfigureOptions<JwtBearerOptions>, JwtBearerOptionsSetup>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
        return services;
    }

    private static ConfigurationManager<JsonWebKeySet> CreateJwksManager(JwksSettings settings, bool allowHttp) =>
        new(settings.Url, new JwksConfigurationRetriever(), new HttpDocumentRetriever { RequireHttps = !allowHttp })
        {
            AutomaticRefreshInterval = TimeSpan.FromMinutes(settings.CacheMinutes),
            RefreshInterval = TimeSpan.FromMinutes(settings.MinRefreshMinutes),
        };
}
