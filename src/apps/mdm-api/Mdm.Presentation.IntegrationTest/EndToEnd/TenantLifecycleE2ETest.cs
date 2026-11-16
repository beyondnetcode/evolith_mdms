using System.Net;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.EndToEnd;

/// <summary>Ciclo de vida de la organización (contrato §4) contra SQL Server real.</summary>
[Collection(MdmApiCollection.Name)]
public sealed class TenantLifecycleE2ETest(MdmApiFixture fixture) : EndToEndTestBase(fixture)
{
    private static readonly Step Suspend = new(HttpMethod.Post, "/suspend");
    private static readonly Step Activate = new(HttpMethod.Post, "/activate");
    private static readonly Step Archive = new(HttpMethod.Delete, string.Empty);

    private async Task<string> StatusOfAsync(Org org)
    {
        using var response = await SendAsync(new Call(HttpMethod.Get, org.Url));
        return (await JsonOf(response)).GetProperty("status").GetString()!;
    }

    [Fact]
    public async Task Suspender_reactivar_y_archivar_recorren_los_estados_y_cada_paso_sube_la_version()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var versions = new List<long> { org.Version };

        await ActAsync(org, new Step(HttpMethod.Post, "/suspend"));
        versions.Add(org.Version);
        (await StatusOfAsync(org)).Should().Be("Suspended");
        await ActAsync(org, new Step(HttpMethod.Post, "/activate"));
        versions.Add(org.Version);
        (await StatusOfAsync(org)).Should().Be("Active");
        await ActAsync(org, new Step(HttpMethod.Delete, string.Empty));
        versions.Add(org.Version);
        (await StatusOfAsync(org)).Should().Be("Archived");

        versions.Should().BeInAscendingOrder().And.OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task Transiciones_repetidas_responden_409_con_su_code()
    {
        RequireApi();
        var org = await CreateTenantAsync();

        await ShouldConflictAsync(org, Activate, "tenant.already_active");
        await ActAsync(org, new Step(HttpMethod.Post, "/suspend"));
        await ShouldConflictAsync(org, Suspend, "tenant.already_suspended");
        await ActAsync(org, new Step(HttpMethod.Delete, string.Empty));
        await ShouldConflictAsync(org, Archive, "tenant.archived");
        await ShouldConflictAsync(org, Suspend, "tenant.archived");
        await ShouldConflictAsync(org, Activate, "tenant.archived");
    }

    [Fact]
    public async Task Modificar_una_organizacion_archivada_responde_409()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        await ActAsync(org, new Step(HttpMethod.Delete, string.Empty));

        using var response = await WriteAsync(org, new Step(HttpMethod.Put, string.Empty, new { name = "Nuevo", organizationType = "CLIENT" }));

        await ShouldBeProblemAsync(response, HttpStatusCode.Conflict, "tenant.archived");
    }

    [Fact]
    public async Task Suspender_con_sedes_activas_responde_409_y_sin_ellas_se_puede()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var branch = await AddBranchAsync(org, "S1");

        await ShouldConflictAsync(org, Suspend, "tenant.has_active_branches");
        await ShouldConflictAsync(org, Archive, "tenant.has_active_branches");
        await ActAsync(org, new Step(HttpMethod.Post, $"/branches/{branch}/deactivate"));
        await ActAsync(org, new Step(HttpMethod.Post, "/suspend"));

        (await StatusOfAsync(org)).Should().Be("Suspended");
    }

    [Fact]
    public async Task El_cuerpo_reason_de_las_acciones_de_organizacion_se_ignora()
    {
        RequireApi();
        var org = await CreateTenantAsync();

        await ActAsync(org, new Step(HttpMethod.Post, "/suspend", new { reason = "mantenimiento" }));
        await ActAsync(org, new Step(HttpMethod.Post, "/activate", new { reason = new string('x', 900) }));

        (await StatusOfAsync(org)).Should().Be("Active");
    }

    [Fact]
    public async Task Alta_de_sede_en_organizacion_suspendida_responde_409_not_active_y_archivada_archived()
    {
        RequireApi();
        var suspended = await CreateTenantAsync();
        await ActAsync(suspended, new Step(HttpMethod.Post, "/suspend"));
        var archived = await CreateTenantAsync();
        await ActAsync(archived, new Step(HttpMethod.Delete, string.Empty));

        using var onSuspended = await WriteAsync(suspended, new Step(HttpMethod.Post, "/branches", new { code = "S1", name = "Sede" }));
        using var onArchived = await WriteAsync(archived, new Step(HttpMethod.Post, "/branches", new { code = "S1", name = "Sede" }));

        await ShouldBeProblemAsync(onSuspended, HttpStatusCode.Conflict, "tenant.not_active");
        await ShouldBeProblemAsync(onArchived, HttpStatusCode.Conflict, "tenant.archived");
    }
}
