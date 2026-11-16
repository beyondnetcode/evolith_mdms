namespace Mdm.Presentation.Security;

/// <summary>
/// Configuración de la verificación del portador (ADR-0157): el JWKS de UMS, el emisor y la audiencia.
/// Nada de esto es secreto; el material de firma privado vive solo en UMS.
/// </summary>
public sealed class AuthenticationSettings
{
    public const string SectionName = "Authentication";

    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public JwksSettings Jwks { get; set; } = new();

    /// <summary>Mensaje de error si falta algún dato obligatorio; <c>null</c> si la configuración es válida.</summary>
    public string? Validate()
    {
        if (string.IsNullOrWhiteSpace(Issuer))
        {
            return $"Falta '{SectionName}:Issuer'.";
        }

        if (string.IsNullOrWhiteSpace(Audience))
        {
            return $"Falta '{SectionName}:Audience'.";
        }

        return Uri.TryCreate(Jwks.Url, UriKind.Absolute, out _)
            ? null
            : $"'{SectionName}:Jwks:Url' debe ser una URL absoluta.";
    }
}

/// <summary>Dónde y cada cuánto se lee el JWKS.</summary>
public sealed class JwksSettings
{
    /// <summary>URL del JWK Set de UMS (<c>/.well-known/jwks.json</c>).</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>Vida de la copia en memoria del JWKS (ADR-0157 §4.4: 60 minutos).</summary>
    public int CacheMinutes { get; set; } = 60;

    /// <summary>Mínimo entre dos recargas forzadas por un <c>kid</c> desconocido (ADR-0157 §4.4: 5 minutos).</summary>
    public int MinRefreshMinutes { get; set; } = 5;
}
