using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Tokens;

namespace Mdm.Presentation.Security;

/// <summary>
/// Elige la clave pública de verificación por <c>kid</c> (ADR-0157 §4.4). Sin <c>kid</c> no hay clave:
/// probar todas es indistinguible de no saber cuál usar. Un <c>kid</c> desconocido provoca UNA recarga,
/// acotada por el intervalo mínimo del gestor de configuración. Si UMS no responde, el gestor conserva el
/// último JWKS bueno; si nunca hubo uno, el token se rechaza (401), no se rompe la petición.
/// </summary>
internal sealed class JwksSigningKeyResolver
{
    private readonly IConfigurationManager<JsonWebKeySet> _jwks;
    private readonly ILogger<JwksSigningKeyResolver> _logger;

    public JwksSigningKeyResolver(IConfigurationManager<JsonWebKeySet> jwks, ILogger<JwksSigningKeyResolver> logger)
    {
        _jwks = jwks;
        _logger = logger;
    }

    // La firma (4 parámetros) la impone el delegado IssuerSigningKeyResolver de IdentityModel.
#pragma warning disable S107
    public IEnumerable<SecurityKey> Resolve(string token, SecurityToken securityToken, string kid, TokenValidationParameters parameters)
    {
        if (string.IsNullOrEmpty(kid))
        {
            return [];
        }

        var keys = Find(kid);
        if (keys.Count > 0)
        {
            return keys;
        }

        _jwks.RequestRefresh();
        return Find(kid);
    }
#pragma warning restore S107

    private List<SecurityKey> Find(string kid)
    {
        try
        {
            // El validador de tokens pide la clave de forma síncrona; la configuración ya está en
            // memoria salvo en la primera petición o tras expirar el TTL.
            var set = _jwks.GetConfigurationAsync(CancellationToken.None).GetAwaiter().GetResult();
            return set.GetSigningKeys().Where(k => k.KeyId == kid).ToList();
        }
        catch (Exception ex) when (ex is InvalidOperationException or HttpRequestException or IOException)
        {
            _logger.LogError(ex, "No se pudo obtener el JWKS de UMS; el portador se rechaza.");
            return [];
        }
    }
}
