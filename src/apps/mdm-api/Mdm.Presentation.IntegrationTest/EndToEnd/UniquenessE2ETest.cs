using System.Net;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.EndToEnd;

/// <summary>Unicidad de código y referencia, y errores de validación, vistos desde HTTP (índices únicos reales).</summary>
[Collection(MdmApiCollection.Name)]
public sealed class UniquenessE2ETest(MdmApiFixture fixture) : EndToEndTestBase(fixture)
{
    private Task<HttpResponseMessage> PostTenantAsync(string code, string? companyReference = null, Guid? parent = null) =>
        SendAsync(new Call(HttpMethod.Post, TenantsUrl)
        {
            Body = new { code, name = "Otra", organizationType = "CLIENT", companyReference, parentTenantId = parent },
        });

    [Fact]
    public async Task Alta_con_codigo_repetido_responde_409_sin_location_incluso_con_otra_capitalizacion()
    {
        RequireApi();
        var org = await CreateTenantAsync();

        using var same = await PostTenantAsync(org.Code);
        using var lower = await PostTenantAsync(org.Code.ToLowerInvariant());

        await ShouldBeProblemAsync(same, HttpStatusCode.Conflict, "tenant.code_not_unique");
        same.Headers.Location.Should().BeNull();
        await ShouldBeProblemAsync(lower, HttpStatusCode.Conflict, "tenant.code_not_unique");
    }

    [Fact]
    public async Task Alta_con_el_codigo_de_una_organizacion_archivada_responde_409()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        await ActAsync(org, new Step(HttpMethod.Delete, string.Empty));

        using var response = await PostTenantAsync(org.Code);

        await ShouldBeProblemAsync(response, HttpStatusCode.Conflict, "tenant.code_not_unique");
    }

    [Fact]
    public async Task Referencia_de_empresa_repetida_responde_409_en_alta_y_en_put()
    {
        RequireApi();
        var reference = "RUC" + Unique;
        await CreateTenantAsync(companyReference: reference);
        var other = await CreateTenantAsync();

        using var create = await PostTenantAsync(NewCode("B"), reference);
        using var update = await WriteAsync(
            other, new Step(HttpMethod.Put, string.Empty, new { name = "Otra", organizationType = "CLIENT", companyReference = reference }));

        await ShouldBeProblemAsync(create, HttpStatusCode.Conflict, "tenant.company_reference_not_unique");
        await ShouldBeProblemAsync(update, HttpStatusCode.Conflict, "tenant.company_reference_not_unique");
    }

    [Fact]
    public async Task Sede_repetida_responde_409_incluso_cerrada_y_el_mismo_codigo_vale_en_otra_organizacion()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var other = await CreateTenantAsync();
        var branch = await AddBranchAsync(org, "SEDE-1");

        using var active = await WriteAsync(org, new Step(HttpMethod.Post, "/branches", new { code = "sede-1", name = "Repetida" }));
        await ActAsync(org, new Step(HttpMethod.Delete, $"/branches/{branch}"));
        using var closed = await WriteAsync(org, new Step(HttpMethod.Post, "/branches", new { code = "SEDE-1", name = "Repetida" }));
        var elsewhere = await AddBranchAsync(other, "SEDE-1");

        await ShouldBeProblemAsync(active, HttpStatusCode.Conflict, "branch.code_not_unique");
        await ShouldBeProblemAsync(closed, HttpStatusCode.Conflict, "branch.code_not_unique");
        elsewhere.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Padre_inexistente_400_padre_archivado_409_y_padre_valido_201()
    {
        RequireApi();
        var parent = await CreateTenantAsync();
        var archived = await CreateTenantAsync();
        await ActAsync(archived, new Step(HttpMethod.Delete, string.Empty));

        using var missing = await PostTenantAsync(NewCode("A"), parent: Guid.NewGuid());
        using var gone = await PostTenantAsync(NewCode("B"), parent: archived.Id);
        var child = await CreateTenantAsync(NewCode("C"), parentId: parent.Id);
        using var read = await SendAsync(new Call(HttpMethod.Get, child.Url));

        await ShouldBeProblemAsync(missing, HttpStatusCode.BadRequest, "tenant.parent_not_found");
        await ShouldBeProblemAsync(gone, HttpStatusCode.Conflict, "tenant.parent_archived");
        (await JsonOf(read)).GetProperty("parentTenantId").GetGuid().Should().Be(parent.Id);
    }

    [Theory]
    [InlineData("", "Nombre", "CLIENT")]
    [InlineData("X", "Nombre", "CLIENT")]
    [InlineData("CODIGO CON ñ", "Nombre", "CLIENT")]
    [InlineData("VALIDO", "", "CLIENT")]
    [InlineData("VALIDO", "Nombre", "OTRO")]
    [InlineData("VALIDO", "Nombre", "")]
    public async Task Alta_invalida_responde_400_validation_failed_con_errors(string code, string name, string type)
    {
        RequireApi();

        using var response = await SendAsync(new Call(HttpMethod.Post, TenantsUrl)
        {
            Body = new { code = code + (code.Length > 2 ? Unique : string.Empty), name, organizationType = type },
        });

        await ShouldBeProblemAsync(response, HttpStatusCode.BadRequest, "validation.failed");
        (await JsonOf(response)).TryGetProperty("errors", out _).Should().BeTrue();
    }

    [Fact]
    public async Task Alta_sin_cuerpo_responde_400()
    {
        RequireApi();

        using var response = await SendAsync(new Call(HttpMethod.Post, TenantsUrl));

        await ShouldBeProblemAsync(response, HttpStatusCode.BadRequest, "validation.failed");
    }

    [Fact]
    public async Task Organizacion_o_sede_inexistente_responde_404_con_code_y_una_ruta_no_guid_tambien()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var unknown = $"{TenantsUrl}/{Guid.NewGuid()}";

        using var tenant = await SendAsync(new Call(HttpMethod.Get, unknown));
        using var branches = await SendAsync(new Call(HttpMethod.Get, unknown + "/branches"));
        using var branch = await SendAsync(new Call(HttpMethod.Get, $"{org.BranchesUrl}/{Guid.NewGuid()}"));
        using var write = await SendAsync(new Call(HttpMethod.Put, unknown) { Body = new { name = "x", organizationType = "CLIENT" }, IfMatch = "\"1\"" });
        using var notGuid = await SendAsync(new Call(HttpMethod.Get, TenantsUrl + "/no-es-guid"));

        await ShouldBeProblemAsync(tenant, HttpStatusCode.NotFound, "common.not_found");
        await ShouldBeProblemAsync(branches, HttpStatusCode.NotFound, "common.not_found");
        await ShouldBeProblemAsync(branch, HttpStatusCode.NotFound, "common.not_found");
        await ShouldBeProblemAsync(write, HttpStatusCode.NotFound, "common.not_found");
        notGuid.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
