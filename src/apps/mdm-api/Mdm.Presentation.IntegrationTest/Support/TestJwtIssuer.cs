using System.Security.Cryptography;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Tokens;

namespace Mdm.Presentation.IntegrationTest.Support;

/// <summary>
/// Emisor de portadores RS256 de prueba con un par de claves efímero generado en el arranque
/// (ADR-0157 §6: ninguna clave versionada) y su JWKS estático. Lo comparten la fábrica sin base de datos
/// y la de SQL Server.
/// </summary>
public sealed class TestJwtIssuer : IDisposable
{
    public const string Issuer = "ums-api";
    public const string Audience = "mdm-api";
    public const string KeyId = "prueba-1";

    private readonly RSA _rsa = RSA.Create(2048);

    /// <summary>Gestor de JWKS estático que sustituye al que descargaría el JWKS de UMS.</summary>
    public IConfigurationManager<JsonWebKeySet> CreateJwksManager()
    {
        var publicKey = JsonWebKeyConverter.ConvertFromRSASecurityKey(new RsaSecurityKey(_rsa.ExportParameters(false)) { KeyId = KeyId });
        publicKey.Use = "sig";
        publicKey.Alg = SecurityAlgorithms.RsaSha256;
        var jwks = new JsonWebKeySet();
        jwks.Keys.Add(publicKey);
        return new StaticConfigurationManager<JsonWebKeySet>(jwks);
    }

    /// <summary>Emite un portador firmado; los parámetros permiten fabricar tokens inválidos.</summary>
    public string IssueToken(string audience = Audience, string? keyId = KeyId, string subject = "usuario-de-prueba")
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = audience,
            Expires = DateTime.UtcNow.AddMinutes(5),
            Claims = new Dictionary<string, object> { ["sub"] = subject },
            SigningCredentials = new SigningCredentials(
                new RsaSecurityKey(_rsa) { KeyId = keyId }, SecurityAlgorithms.RsaSha256),
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    public void Dispose() => _rsa.Dispose();
}
