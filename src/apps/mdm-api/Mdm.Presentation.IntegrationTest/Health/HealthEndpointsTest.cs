using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Mdm.Presentation;
using Mdm.Presentation.Endpoints.Health;

namespace Mdm.Presentation.IntegrationTest.Health;

public sealed class HealthEndpointsTest(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Get_health_responde_200_con_estado_ok()
    {
        using var client = factory.CreateClient();

        var respuesta = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        respuesta.StatusCode.Should().Be(HttpStatusCode.OK);
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<HealthResponse>(TestContext.Current.CancellationToken);
        cuerpo.Should().Be(new HealthResponse("ok"));
    }
}
