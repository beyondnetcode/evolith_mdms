using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Mdm.Presentation.Security;

/// <summary>
/// Parámetros de validación del portador: solo RS256, emisor y audiencia explícitos (RFC 8725), clave
/// por <c>kid</c> desde el JWKS. Se configura aquí, tarde, para que las pruebas puedan sustituir el
/// gestor del JWKS por uno con claves efímeras.
/// </summary>
internal sealed class JwtBearerOptionsSetup : IConfigureNamedOptions<JwtBearerOptions>
{
    private readonly AuthenticationSettings _settings;
    private readonly JwksSigningKeyResolver _resolver;

    public JwtBearerOptionsSetup(IOptions<AuthenticationSettings> settings, JwksSigningKeyResolver resolver)
    {
        _settings = settings.Value;
        _resolver = resolver;
    }

    public void Configure(JwtBearerOptions options) => Configure(JwtBearerDefaults.AuthenticationScheme, options);

    public void Configure(string? name, JwtBearerOptions options)
    {
        if (name != JwtBearerDefaults.AuthenticationScheme)
        {
            return;
        }

        // Sin Authority: la clave sale del JWKS configurado, no de un descubrimiento OIDC.
        // Los claims se conservan con su nombre original: el actor es siempre «sub».
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            RequireSignedTokens = true,
            IssuerSigningKeyResolver = _resolver.Resolve,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
            ValidateIssuer = true,
            ValidIssuer = _settings.Issuer,
            ValidateAudience = true,
            ValidAudience = _settings.Audience,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = CurrentUserClaims.Subject,
        };
    }
}
