using System.Net;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.EndToEnd;

/// <summary>Autenticación JWT RS256 real sobre la API completa (ADR-0157): 401 con code, /health anónimo.</summary>
[Collection(MdmApiCollection.Name)]
public sealed class SecurityE2ETest(MdmApiFixture fixture) : EndToEndTestBase(fixture)
{
    [Fact]
    public async Task Sin_portador_responde_401_en_lectura_y_en_escritura()
    {
        RequireApi();
        var org = await CreateTenantAsync();

        using var read = await SendAsync(new Call(HttpMethod.Get, TenantsUrl) { Anonymous = true });
        using var write = await SendAsync(new Call(HttpMethod.Put, org.Url)
        {
            Anonymous = true,
            IfMatch = Quote(org.Version),
            Body = new { name = "x", organizationType = "CLIENT" },
        });

        await ShouldBeProblemAsync(read, HttpStatusCode.Unauthorized, "auth.unauthenticated");
        await ShouldBeProblemAsync(write, HttpStatusCode.Unauthorized, "auth.unauthenticated");
    }

    [Fact]
    public async Task Audiencia_erronea_o_kid_desconocido_responden_401()
    {
        RequireApi();

        using var audience = await SendAsync(new Call(HttpMethod.Get, TenantsUrl) { Token = Fixture.IssueToken(audience: "otra-api") });
        using var kid = await SendAsync(new Call(HttpMethod.Get, TenantsUrl) { Token = Fixture.IssueToken(keyId: "desconocida") });

        await ShouldBeProblemAsync(audience, HttpStatusCode.Unauthorized, "auth.unauthenticated");
        await ShouldBeProblemAsync(kid, HttpStatusCode.Unauthorized, "auth.unauthenticated");
    }

    [Fact]
    public async Task Ruta_desconocida_sin_token_responde_401_y_con_token_404()
    {
        RequireApi();

        using var anonymous = await SendAsync(new Call(HttpMethod.Get, "/api/v1/no-existe") { Anonymous = true });
        using var authenticated = await SendAsync(new Call(HttpMethod.Get, "/api/v1/no-existe"));

        anonymous.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        authenticated.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Health_es_anonimo()
    {
        RequireApi();

        using var response = await SendAsync(new Call(HttpMethod.Get, "/health") { Anonymous = true });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
