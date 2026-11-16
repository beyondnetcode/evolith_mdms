using System.Net;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.EndToEnd;

/// <summary>Ciclo de vida de la sede (contrato §2.2 y §4) contra SQL Server real.</summary>
[Collection(MdmApiCollection.Name)]
public sealed class BranchLifecycleE2ETest(MdmApiFixture fixture) : EndToEndTestBase(fixture)
{
    private async Task<System.Text.Json.JsonElement> ReadBranchAsync(Org org, Guid branchId)
    {
        using var response = await SendAsync(new Call(HttpMethod.Get, $"{org.BranchesUrl}/{branchId}"));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return await JsonOf(response);
    }

    [Fact]
    public async Task Alta_responde_201_con_location_y_la_sede_se_lee()
    {
        RequireApi();
        var org = await CreateTenantAsync();

        using var created = await WriteAsync(org, new Step(HttpMethod.Post, "/branches", new { code = "lima-1", name = "Lima 1" }));

        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = (await JsonOf(created)).GetProperty("id").GetGuid();
        created.Headers.Location!.ToString().Should().EndWith($"/api/v1/tenants/{org.Id}/branches/{id}");
        var branch = await ReadBranchAsync(org, id);
        branch.GetProperty("code").GetString().Should().Be("LIMA-1");
        branch.GetProperty("tenantId").GetGuid().Should().Be(org.Id);
        branch.GetProperty("isActive").GetBoolean().Should().BeTrue();
        branch.GetProperty("isClosed").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Renombrar_desactivar_reactivar_y_cerrar_recorren_la_sede()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var id = await AddBranchAsync(org, "S1");

        await ActAsync(org, new Step(HttpMethod.Put, $"/branches/{id}", new { name = "Renombrada" }));
        (await ReadBranchAsync(org, id)).GetProperty("name").GetString().Should().Be("Renombrada");

        await ActAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/deactivate", new { reason = "obras" }));
        (await ReadBranchAsync(org, id)).GetProperty("isActive").GetBoolean().Should().BeFalse();

        await ActAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/reactivate"));
        (await ReadBranchAsync(org, id)).GetProperty("isActive").GetBoolean().Should().BeTrue();

        await ActAsync(org, new Step(HttpMethod.Delete, $"/branches/{id}", new { reason = "cierre definitivo" }));
        var closed = await ReadBranchAsync(org, id);
        closed.GetProperty("isClosed").GetBoolean().Should().BeTrue();
        closed.GetProperty("closedBy").GetString().Should().Be("usuario-de-prueba");
        closed.GetProperty("closedAt").ValueKind.Should().NotBe(System.Text.Json.JsonValueKind.Null);
    }

    [Fact]
    public async Task Transiciones_repetidas_de_sede_responden_409_con_su_code()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var id = await AddBranchAsync(org, "S1");

        await ShouldConflictAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/reactivate"), "branch.already_active");
        await ActAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/deactivate"));
        await ShouldConflictAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/deactivate"), "branch.already_inactive");
    }

    [Fact]
    public async Task Una_sede_cerrada_no_se_modifica_ni_se_reactiva_ni_se_vuelve_a_cerrar()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var id = await AddBranchAsync(org, "S1");
        await ActAsync(org, new Step(HttpMethod.Delete, $"/branches/{id}"));

        await ShouldConflictAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/reactivate"), "branch.closed");
        await ShouldConflictAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/deactivate"), "branch.closed");
        await ShouldConflictAsync(org, new Step(HttpMethod.Delete, $"/branches/{id}"), "branch.closed");
        using var rename = await WriteAsync(org, new Step(HttpMethod.Put, $"/branches/{id}", new { name = "Nuevo" }));
        await ShouldBeProblemAsync(rename, HttpStatusCode.Conflict, "branch.closed");
    }

    [Fact]
    public async Task Se_puede_cerrar_una_sede_desactivada()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var id = await AddBranchAsync(org, "S1");
        await ActAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/deactivate"));

        await ActAsync(org, new Step(HttpMethod.Delete, $"/branches/{id}"));

        (await ReadBranchAsync(org, id)).GetProperty("isClosed").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Motivo_de_mas_de_500_caracteres_en_una_accion_de_sede_responde_400()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var id = await AddBranchAsync(org, "S1");

        using var response = await WriteAsync(org, new Step(HttpMethod.Post, $"/branches/{id}/deactivate", new { reason = new string('x', 501) }));

        await ShouldBeProblemAsync(response, HttpStatusCode.BadRequest, "validation.failed");
    }

    [Fact]
    public async Task Alta_o_renombre_invalido_de_sede_responde_400()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var id = await AddBranchAsync(org, "S1");

        using var noCode = await WriteAsync(org, new Step(HttpMethod.Post, "/branches", new { name = "Sin código" }));
        using var noName = await WriteAsync(org, new Step(HttpMethod.Put, $"/branches/{id}", new { name = " " }));

        await ShouldBeProblemAsync(noCode, HttpStatusCode.BadRequest, "validation.failed");
        await ShouldBeProblemAsync(noName, HttpStatusCode.BadRequest, "validation.failed");
    }

    [Fact]
    public async Task Listar_sedes_filtra_por_estado_y_estado_invalido_responde_400()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var active = await AddBranchAsync(org, "ACTIVA");
        var inactive = await AddBranchAsync(org, "INACTIVA");
        var closed = await AddBranchAsync(org, "CERRADA");
        await ActAsync(org, new Step(HttpMethod.Post, $"/branches/{inactive}/deactivate"));
        await ActAsync(org, new Step(HttpMethod.Delete, $"/branches/{closed}"));

        async Task<string[]> CodesAsync(string query)
        {
            using var response = await SendAsync(new Call(HttpMethod.Get, org.BranchesUrl + query));
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            return (await JsonOf(response)).EnumerateArray().Select(e => e.GetProperty("code").GetString()!).Order().ToArray();
        }

        (await CodesAsync(string.Empty)).Should().Equal("ACTIVA", "CERRADA", "INACTIVA");
        (await CodesAsync("?status=active")).Should().Equal("ACTIVA");
        (await CodesAsync("?status=inactive")).Should().Equal("INACTIVA");
        (await CodesAsync("?status=closed")).Should().Equal("CERRADA");
        using var invalid = await SendAsync(new Call(HttpMethod.Get, org.BranchesUrl + "?status=otro"));
        await ShouldBeProblemAsync(invalid, HttpStatusCode.BadRequest, "validation.failed");
        active.Should().NotBeEmpty();
    }
}
