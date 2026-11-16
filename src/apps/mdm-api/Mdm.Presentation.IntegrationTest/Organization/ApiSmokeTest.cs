using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.Organization;

/// <summary>
/// Humo sin Docker: autenticación obligatoria, <c>If-Match</c> y <c>ETag</c> del contrato. Las filas del
/// contrato contra SQL Server y un JWT real las ejerce la integración de T6.
/// </summary>
public sealed class ApiSmokeTest : IClassFixture<SmokeApiFactory>
{
    private const string ProblemJson = "application/problem+json";
    private static readonly string TenantUrl = $"/api/v1/tenants/{FakeTenantReadStore.KnownTenantId}";

    private readonly SmokeApiFactory _factory;

    public ApiSmokeTest(SmokeApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Listar_sin_portador_responde_401_como_problem_json_con_code()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync(new Uri("/api/v1/tenants", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        response.Content.Headers.ContentType?.MediaType.Should().Be(ProblemJson);
        (await CodeOf(response)).Should().Be("auth.unauthenticated");
    }

    [Fact]
    public async Task Health_es_anonimo()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("PUT", "")]
    [InlineData("POST", "/suspend")]
    [InlineData("POST", "/activate")]
    [InlineData("DELETE", "")]
    [InlineData("POST", "/branches")]
    [InlineData("PUT", "/branches/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c12")]
    [InlineData("POST", "/branches/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c12/deactivate")]
    [InlineData("POST", "/branches/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c12/reactivate")]
    [InlineData("DELETE", "/branches/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c12")]
    public async Task Escribir_sin_if_match_responde_428(string method, string suffix)
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(new HttpMethod(method), TenantUrl + suffix);

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be((HttpStatusCode)428);
        response.Content.Headers.ContentType?.MediaType.Should().Be(ProblemJson);
        (await CodeOf(response)).Should().Be("precondition.required");
    }

    [Fact]
    public async Task If_match_comodin_responde_428()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Post, TenantUrl + "/suspend");
        request.Headers.TryAddWithoutValidation("If-Match", "*");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be((HttpStatusCode)428);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("7")]
    [InlineData("W/\"7\"")]
    public async Task If_match_mal_formado_responde_400_con_el_campo(string ifMatch)
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Post, TenantUrl + "/suspend");
        request.Headers.TryAddWithoutValidation("If-Match", ifMatch);

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await CodeOf(response)).Should().Be("validation.failed");
    }

    [Fact]
    public async Task Consultar_una_organizacion_devuelve_etag_fuerte_con_la_version()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Get, TenantUrl);

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.ETag.Should().Be(new EntityTagHeaderValue("\"7\""));
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        body.RootElement.GetProperty("organizationType").GetString().Should().Be("INTERNAL");
        body.RootElement.GetProperty("createdAt").GetString().Should().Be("2026-10-21T15:04:05.100+00:00");
        body.RootElement.GetProperty("createdBy").GetString().Should().Be("usuario-001");
        body.RootElement.TryGetProperty("updatedBy", out var updatedBy).Should().BeTrue();
        updatedBy.ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Consultar_con_if_none_match_vigente_responde_304_sin_cuerpo()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Get, TenantUrl);
        request.Headers.TryAddWithoutValidation("If-None-Match", "\"7\"");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotModified);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().BeEmpty();
    }

    [Fact]
    public async Task Consultar_una_organizacion_inexistente_responde_404_con_code()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Get, $"/api/v1/tenants/{Guid.NewGuid()}");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await CodeOf(response)).Should().Be("common.not_found");
    }

    [Fact]
    public async Task Un_identificador_que_no_es_guid_responde_404()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Get, "/api/v1/tenants/no-es-guid");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("code")]
    [InlineData("name")]
    [InlineData("createdAt")]
    public async Task Listar_admite_los_tres_ordenes_del_contrato(string sortBy)
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Get, $"/api/v1/tenants?sortBy={sortBy}&sortOrder=desc");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Listar_con_orden_desconocido_responde_400()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Get, "/api/v1/tenants?sortBy=id");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Listar_con_pagina_ilegible_responde_400()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Get, "/api/v1/tenants?pageSize=101");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await CodeOf(response)).Should().Be("validation.failed");
    }

    [Fact]
    public async Task Alta_con_json_ilegible_responde_400_como_problem_json()
    {
        using var client = _factory.CreateClient();
        using var request = Authenticated(HttpMethod.Post, "/api/v1/tenants");
        request.Content = new StringContent("{ no es json", System.Text.Encoding.UTF8, "application/json");

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType?.MediaType.Should().Be(ProblemJson);
    }

    private static HttpRequestMessage Authenticated(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, new Uri(url, UriKind.Relative));
        request.Headers.Add(TestAuthHandler.SubjectHeader, "usuario-de-prueba");
        return request;
    }

    private static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return body.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }
}
