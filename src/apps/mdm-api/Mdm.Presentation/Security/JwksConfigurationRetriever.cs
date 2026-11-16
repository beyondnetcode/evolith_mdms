using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Tokens;

namespace Mdm.Presentation.Security;

/// <summary>Lee un JWK Set (RFC 7517) y lo entrega tal cual a <c>ConfigurationManager</c>, que lo cachea.</summary>
internal sealed class JwksConfigurationRetriever : IConfigurationRetriever<JsonWebKeySet>
{
    public async Task<JsonWebKeySet> GetConfigurationAsync(string address, IDocumentRetriever retriever, CancellationToken cancel)
    {
        ArgumentNullException.ThrowIfNull(retriever);
        var json = await retriever.GetDocumentAsync(address, cancel).ConfigureAwait(false);
        return new JsonWebKeySet(json);
    }
}
