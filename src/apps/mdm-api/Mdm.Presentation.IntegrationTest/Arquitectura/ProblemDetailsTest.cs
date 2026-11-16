using System.Net;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.Arquitectura;

/// <summary>
/// Los errores salen como Problem Details. Con la política por defecto «usuario autenticado» (ADR-0230),
/// una ruta inexistente exige antes portador: el anónimo recibe 401 y el autenticado, 404.
/// </summary>
public sealed class ProblemDetailsTest(SmokeApiFactory factory) : IClassFixture<SmokeApiFactory>
{
    private const string ProblemJson = "application/problem+json";

    [Fact]
    public async Task Ruta_inexistente_con_portador_responde_404_como_problem_json()
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/no-existe", UriKind.Relative));
        request.Headers.Add(TestAuthHandler.SubjectHeader, "usuario-de-prueba");

        var respuesta = await client.SendAsync(request, TestContext.Current.CancellationToken);

        respuesta.StatusCode.Should().Be(HttpStatusCode.NotFound);
        respuesta.Content.Headers.ContentType?.MediaType.Should().Be(ProblemJson);
    }

    [Fact]
    public async Task Ruta_inexistente_sin_portador_responde_401_como_problem_json()
    {
        using var client = factory.CreateClient();

        var respuesta = await client.GetAsync(new Uri("/no-existe", UriKind.Relative), TestContext.Current.CancellationToken);

        respuesta.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        respuesta.Content.Headers.ContentType?.MediaType.Should().Be(ProblemJson);
    }
}
