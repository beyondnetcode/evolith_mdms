using FluentAssertions;
using Mdm.Application.Common;
using Mdm.Application.Organization.DTOs;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Infrastructure.IntegrationTest.Infrastructure;
using Mdm.Infrastructure.Persistence;

namespace Mdm.Infrastructure.IntegrationTest;

[Collection(MsSqlCollection.Name)]
public sealed class LecturaTenantTest(MsSqlContainerFixture fixture) : MsSqlTestBase(fixture)
{
    private const int Total = 25;

    private async Task SeedAsync(string prefix, int count)
    {
        for (var i = 0; i < count; i++)
        {
            // Mismo nombre para todos: el orden por nombre solo es estable si desempata por Id.
            var tenant = NewTenant($"{prefix}{i:D2}");
            await SaveNewAsync(tenant);
        }
    }

    private async Task<PagedResult<TenantDto>> ListAsync(ListTenantsFilter filter)
    {
        await using var context = Fixture.CreateContext();
        return await new TenantReadStore(context).ListAsync(filter, CancellationToken.None);
    }

    [Fact]
    public async Task Pagina_por_codigo_ascendente_con_total_y_sin_repetir_filas()
    {
        RequireSqlServer();
        var prefix = "PAG" + Unique;
        await SeedAsync(prefix, Total);
        var pages = new List<TenantDto>();

        for (var page = 1; page <= 3; page++)
        {
            var result = await ListAsync(new ListTenantsFilter(page, 10, null, prefix, "code", "asc"));
            result.TotalCount.Should().Be(Total);
            result.Page.Should().Be(page);
            pages.AddRange(result.Items);
        }

        pages.Should().HaveCount(Total);
        pages.Select(t => t.Id).Should().OnlyHaveUniqueItems();
        pages.Select(t => t.Code).Should().BeInAscendingOrder(StringComparer.Ordinal);
    }

    [Fact]
    public async Task La_ultima_pagina_trae_el_resto_y_una_pagina_mas_alla_viene_vacia()
    {
        RequireSqlServer();
        var prefix = "ULT" + Unique;
        await SeedAsync(prefix, Total);

        var last = await ListAsync(new ListTenantsFilter(3, 10, null, prefix, "code", "asc"));
        var beyond = await ListAsync(new ListTenantsFilter(4, 10, null, prefix, "code", "asc"));

        last.Items.Should().HaveCount(5);
        beyond.Items.Should().BeEmpty();
        beyond.TotalCount.Should().Be(Total);
    }

    [Fact]
    public async Task Ordena_por_codigo_descendente()
    {
        RequireSqlServer();
        var prefix = "DES" + Unique;
        await SeedAsync(prefix, 12);

        var result = await ListAsync(new ListTenantsFilter(1, 50, null, prefix, "code", "desc"));

        result.Items.Select(t => t.Code).Should().BeInDescendingOrder(StringComparer.Ordinal);
    }

    [Fact]
    public async Task Ordenar_por_nombre_con_valores_iguales_desempata_por_Id_y_no_pierde_filas_entre_paginas()
    {
        RequireSqlServer();
        var prefix = "NOM" + Unique;
        for (var i = 0; i < 12; i++)
        {
            var data = new Mdm.Domain.Organization.Tenant.NewTenant(
                Code.Create($"{prefix}{i:D2}"), Name.Create("Mismo nombre " + prefix),
                Mdm.Domain.Organization.Tenant.OrganizationType.CLIENT);
            await SaveNewAsync(Mdm.Domain.Organization.Tenant.Tenant.Create(data, Actor).Value);
        }

        var first = await ListAsync(new ListTenantsFilter(1, 5, null, prefix, "name", "asc"));
        var second = await ListAsync(new ListTenantsFilter(2, 5, null, prefix, "name", "asc"));
        var third = await ListAsync(new ListTenantsFilter(3, 5, null, prefix, "name", "asc"));

        var ids = first.Items.Concat(second.Items).Concat(third.Items).Select(t => t.Id).ToList();
        ids.Should().HaveCount(12).And.OnlyHaveUniqueItems();
        // Repetir la consulta devuelve el mismo orden: el desempate por Id es determinista.
        var again = await ListAsync(new ListTenantsFilter(1, 5, null, prefix, "name", "asc"));
        again.Items.Select(t => t.Id).Should().Equal(first.Items.Select(t => t.Id));
    }

    [Fact]
    public async Task Ordena_por_fecha_de_alta_con_desempate_por_Id_y_sin_perder_filas_entre_paginas()
    {
        RequireSqlServer();
        var prefix = "CRE" + Unique;
        await SeedAsync(prefix, 12);

        var first = await ListAsync(new ListTenantsFilter(1, 5, null, prefix, "createdat", "desc"));
        var second = await ListAsync(new ListTenantsFilter(2, 5, null, prefix, "createdat", "desc"));
        var third = await ListAsync(new ListTenantsFilter(3, 5, null, prefix, "createdat", "desc"));

        var all = first.Items.Concat(second.Items).Concat(third.Items).ToList();
        all.Should().HaveCount(12);
        all.Select(t => t.Id).Should().OnlyHaveUniqueItems();
        all.Select(t => t.CreatedAt).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task Filtra_por_estado_y_busca_por_codigo_o_nombre()
    {
        RequireSqlServer();
        var prefix = "FIL" + Unique;
        await SeedAsync(prefix, 4);
        await using (var context = Fixture.CreateContext())
        {
            var repository = new SqlServerTenantRepository(context);
            var tenant = (await repository.GetByCodeAsync(Code.Create(prefix + "01")))!;
            tenant.Suspend(Actor).IsSuccess.Should().BeTrue();
            await repository.UpdateAsync(tenant);
            await repository.SaveChangesAsync();
        }

        var suspended = await ListAsync(new ListTenantsFilter(1, 50, "Suspended", prefix, "code", "asc"));
        var byName = await ListAsync(new ListTenantsFilter(1, 50, null, "Organización " + prefix + "02", "code", "asc"));
        var unknownStatus = await ListAsync(new ListTenantsFilter(1, 50, "NoExiste", prefix, "code", "asc"));

        suspended.Items.Should().ContainSingle().Which.Status.Should().Be("Suspended");
        byName.Items.Should().ContainSingle().Which.Code.Should().Be(prefix + "02");
        unknownStatus.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Get_proyecta_tipo_y_estado_por_nombre_y_el_Id_inexistente_da_nulo()
    {
        RequireSqlServer();
        var tenant = NewTenant("GET" + Unique);
        await SaveNewAsync(tenant);
        await using var context = Fixture.CreateContext();
        var store = new TenantReadStore(context);

        var dto = await store.GetAsync(tenant.TenantId.GetValue(), CancellationToken.None);
        var missing = await store.GetAsync(Guid.NewGuid(), CancellationToken.None);

        dto.Should().NotBeNull();
        dto!.Type.Should().Be("CLIENT");
        dto.Status.Should().Be("Active");
        dto.Version.Should().Be(1);
        dto.UpdatedAt.Should().BeNull();
        dto.UpdatedBy.Should().BeNull();
        dto.CreatedBy.Should().Be(Actor.GetValue());
        missing.Should().BeNull();
    }

    [Fact]
    public async Task Las_sedes_se_filtran_por_estado_y_llevan_la_version_del_tenant()
    {
        RequireSqlServer();
        var tenant = NewTenant("SED" + Unique);
        var lima = tenant.AddBranch(Code.Create("LIMA"), Name.Create("Lima"), Actor).Value;
        var pisco = tenant.AddBranch(Code.Create("PISCO"), Name.Create("Pisco"), Actor).Value;
        var cusco = tenant.AddBranch(Code.Create("CUSCO"), Name.Create("Cusco"), Actor).Value;
        tenant.DeactivateBranch(pisco.BranchId, Actor).IsSuccess.Should().BeTrue();
        tenant.CloseBranch(cusco.BranchId, Actor).IsSuccess.Should().BeTrue();
        await SaveNewAsync(tenant);
        await using var context = Fixture.CreateContext();
        var store = new TenantReadStore(context);
        var id = tenant.TenantId.GetValue();

        var active = await store.ListBranchesAsync(id, BranchStatusFilter.Active, CancellationToken.None);
        var inactive = await store.ListBranchesAsync(id, BranchStatusFilter.Inactive, CancellationToken.None);
        var closed = await store.ListBranchesAsync(id, BranchStatusFilter.Closed, CancellationToken.None);
        var all = await store.ListBranchesAsync(id, BranchStatusFilter.All, CancellationToken.None);
        var one = await store.GetBranchAsync(id, lima.BranchId.GetValue(), CancellationToken.None);

        active.Select(b => b.Code).Should().Equal("LIMA");
        inactive.Select(b => b.Code).Should().Equal("PISCO");
        closed.Should().ContainSingle().Which.ClosedAt.Should().NotBeNull();
        closed[0].ClosedBy.Should().Be(Actor.GetValue());
        active[0].ClosedBy.Should().BeNull();
        all.Select(b => b.Code).Should().Equal("CUSCO", "LIMA", "PISCO");
        all.Should().OnlyContain(b => b.TenantVersion == tenant.Version);
        one!.TenantVersion.Should().Be(tenant.Version);
        (await store.GetBranchAsync(Guid.NewGuid(), lima.BranchId.GetValue(), CancellationToken.None)).Should().BeNull();
    }
}
