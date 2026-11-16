namespace Mdm.Presentation.Security;

/// <summary>Claims del portador que la API lee.</summary>
public static class CurrentUserClaims
{
    /// <summary>Sujeto autenticado (RFC 7519 §4.1.2): el identificador del actor.</summary>
    public const string Subject = "sub";
}
