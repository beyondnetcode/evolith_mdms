using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.EndToEnd;

/// <summary>Una petición HTTP de prueba; sin portador explícito usa uno válido.</summary>
public sealed record Call(HttpMethod Method, string Url)
{
    public object? Body { get; init; }

    public string? IfMatch { get; init; }

    public string? IfNoneMatch { get; init; }

    /// <summary>Portador explícito (p. ej. uno de audiencia errónea). Nulo: el válido.</summary>
    public string? Token { get; init; }

    public bool Anonymous { get; init; }
}

/// <summary>Una escritura sobre una organización: método, sufijo de la ruta y cuerpo opcional.</summary>
public sealed record Step(HttpMethod Method, string Suffix, object? Body = null);

/// <summary>Una organización creada por la prueba, con la última versión (ETag) que se le conoce.</summary>
public sealed class Org(Guid id, string code, long version)
{
    public Guid Id { get; } = id;

    public string Code { get; } = code;

    public long Version { get; set; } = version;

    public string Url => $"/api/v1/tenants/{Id}";

    public string BranchesUrl => Url + "/branches";
}

/// <summary>
/// Base de las pruebas extremo a extremo: HTTP real contra la API completa, SQL Server en contenedor y JWT
/// RS256 de prueba. Sin Docker, cada prueba se salta con el motivo (<see cref="RequireApi"/>).
/// </summary>
public abstract class EndToEndTestBase(MdmApiFixture fixture) : IDisposable
{
    protected const string ProblemJson = "application/problem+json";
    protected const string TenantsUrl = "/api/v1/tenants";

    private HttpClient? _client;

    protected MdmApiFixture Fixture { get; } = fixture;

    /// <summary>Sufijo único por prueba: la base se comparte dentro de la colección.</summary>
    protected string Unique { get; } = Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();

    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    protected string NewCode(string prefix = "T") => $"{prefix}{Unique}";

    protected void RequireApi() => Assert.SkipUnless(Fixture.IsAvailable, Fixture.UnavailableReason);

    protected HttpClient Client => _client ??= Fixture.Factory.CreateClient();

    protected async Task<HttpResponseMessage> SendAsync(Call call)
    {
        ArgumentNullException.ThrowIfNull(call);
        using var request = new HttpRequestMessage(call.Method, new Uri(call.Url, UriKind.Relative));
        if (!call.Anonymous)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", call.Token ?? Fixture.IssueToken());
        }

        if (call.IfMatch is not null)
        {
            request.Headers.TryAddWithoutValidation("If-Match", call.IfMatch);
        }

        if (call.IfNoneMatch is not null)
        {
            request.Headers.TryAddWithoutValidation("If-None-Match", call.IfNoneMatch);
        }

        if (call.Body is not null)
        {
            request.Content = JsonContent.Create(call.Body);
        }

        return await Client.SendAsync(request, Ct);
    }

    protected static string Quote(long version) => "\"" + version.ToString(CultureInfo.InvariantCulture) + "\"";

    protected static long VersionOf(HttpResponseMessage response)
    {
        var tag = response.Headers.ETag?.Tag;
        tag.Should().NotBeNull("toda respuesta correcta de lectura o escritura lleva ETag");
        return long.Parse(tag!.Trim('"'), CultureInfo.InvariantCulture);
    }

    protected static async Task<JsonElement> JsonOf(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return doc.RootElement.Clone();
    }

    /// <summary>Crea una organización (201) y devuelve su identificador y versión.</summary>
    protected async Task<Org> CreateTenantAsync(string? code = null, string? companyReference = null, Guid? parentId = null)
    {
        code ??= NewCode();
        using var response = await SendAsync(new Call(HttpMethod.Post, TenantsUrl)
        {
            Body = new { code, name = "Organización " + code, organizationType = "CLIENT", companyReference, parentTenantId = parentId },
        });
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(Ct));
        var body = await JsonOf(response);
        return new Org(body.GetProperty("id").GetGuid(), code, VersionOf(response));
    }

    /// <summary>Escribe con el <c>If-Match</c> vigente de la organización y, si tiene éxito, adopta el nuevo ETag.</summary>
    protected async Task<HttpResponseMessage> WriteAsync(Org org, Step step)
    {
        ArgumentNullException.ThrowIfNull(org);
        ArgumentNullException.ThrowIfNull(step);
        var response = await SendAsync(new Call(step.Method, org.Url + step.Suffix) { Body = step.Body, IfMatch = Quote(org.Version) });
        if (response.IsSuccessStatusCode)
        {
            org.Version = VersionOf(response);
        }

        return response;
    }

    /// <summary>Escritura que debe salir bien (204).</summary>
    protected async Task ActAsync(Org org, Step step)
    {
        using var response = await WriteAsync(org, step);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(Ct));
    }

    /// <summary>Da de alta una sede (201) y devuelve su identificador.</summary>
    protected async Task<Guid> AddBranchAsync(Org org, string code)
    {
        using var response = await WriteAsync(org, new Step(HttpMethod.Post, "/branches", new { code, name = "Sede " + code }));
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(Ct));
        return (await JsonOf(response)).GetProperty("id").GetGuid();
    }

    /// <summary>La respuesta es un Problem Details con el estado y el <c>code</c> indicados.</summary>
    protected static async Task ShouldBeProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        ArgumentNullException.ThrowIfNull(response);
        var text = await response.Content.ReadAsStringAsync(Ct);
        response.StatusCode.Should().Be(status, text);
        response.Content.Headers.ContentType?.MediaType.Should().Be(ProblemJson, text);
        using var doc = JsonDocument.Parse(text);
        doc.RootElement.GetProperty("code").GetString().Should().Be(code, text);
        doc.RootElement.GetProperty("status").GetInt32().Should().Be((int)status);
    }

    /// <summary>Intenta una escritura con el ETag vigente y verifica el 409 con el <c>code</c> esperado.</summary>
    protected async Task ShouldConflictAsync(Org org, Step step, string code)
    {
        using var response = await WriteAsync(org, step);
        await ShouldBeProblemAsync(response, HttpStatusCode.Conflict, code);
    }

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (disposing)
        {
            _client?.Dispose();
        }
    }
}
