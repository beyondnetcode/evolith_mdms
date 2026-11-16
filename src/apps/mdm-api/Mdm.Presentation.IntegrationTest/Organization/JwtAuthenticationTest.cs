using System.Net;
using System.Net.Http.Headers;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.Organization;

/// <summary>Validación real del portador RS256 contra un JWKS efímero (sin Docker).</summary>
public sealed class JwtAuthenticationTest : IClassFixture<JwtApiFactory>
{
    private static readonly string TenantUrl = $"/api/v1/tenants/{FakeTenantReadStore.KnownTenantId}";

    private readonly JwtApiFactory _factory;

    public JwtAuthenticationTest(JwtApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Portador_valido_accede()
    {
        var response = await GetAsync(_factory.IssueToken());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Portador_con_otra_audiencia_responde_401()
    {
        var response = await GetAsync(_factory.IssueToken(audience: "otro-sistema"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Portador_con_kid_desconocido_responde_401()
    {
        var response = await GetAsync(_factory.IssueToken(keyId: "no-publicado"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Portador_sin_kid_responde_401()
    {
        var response = await GetAsync(_factory.IssueToken(keyId: null));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Escritura_con_portador_valido_sin_if_match_responde_428()
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(TenantUrl + "/suspend", UriKind.Relative));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _factory.IssueToken());

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be((HttpStatusCode)428);
    }

    private async Task<HttpResponseMessage> GetAsync(string token)
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(TenantUrl, UriKind.Relative));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
