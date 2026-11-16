namespace Mdm.Application.Test.Tenants;

using Moq;
using Mdm.Application.Common;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.Branches.Queries;
using Mdm.Application.Organization.DTOs;
using Mdm.Application.Organization.Tenants.Queries;
using Mdm.Domain.Kernel;

public sealed class QueryHandlersTest
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid BranchId = Guid.NewGuid();
    private static readonly CancellationToken Ct = CancellationToken.None;

    private readonly Mock<ITenantReadStore> _store = new();

    private static TenantDto Tenant() =>
        new(TenantId, "LIMA", "Organización", "INTERNAL", "Active", null, "20100412447", 3, DateTimeOffset.UnixEpoch, "usuario-001", null, null);

    private static BranchDto Branch() => new(BranchId, TenantId, "SEDE1", "Sede 1", true, false, null, null, 3);

    [Fact]
    public async Task ListTenants_normaliza_el_filtro_antes_de_llegar_al_store()
    {
        ListTenantsFilter? received = null;
        var page = new PagedResult<TenantDto>([Tenant()], 2, 10, 11);
        _store.Setup(s => s.ListAsync(It.IsAny<ListTenantsFilter>(), Ct))
            .Callback<ListTenantsFilter, CancellationToken>((f, _) => received = f)
            .ReturnsAsync(page);

        var result = await new ListTenantsQueryHandler(_store.Object)
            .Handle(new ListTenantsQuery(2, 10, " suspended ", "  lima  ", " NAME ", " DESC "), Ct);

        result.Value.Should().BeSameAs(page);
        received.Should().Be(new ListTenantsFilter(2, 10, "Suspended", "lima", "name", "desc"));
    }

    [Fact]
    public async Task ListTenants_omite_estado_y_busqueda_vacios()
    {
        ListTenantsFilter? received = null;
        _store.Setup(s => s.ListAsync(It.IsAny<ListTenantsFilter>(), Ct))
            .Callback<ListTenantsFilter, CancellationToken>((f, _) => received = f)
            .ReturnsAsync(new PagedResult<TenantDto>([], 1, 20, 0));

        await new ListTenantsQueryHandler(_store.Object).Handle(new ListTenantsQuery(Status: " ", Search: "  "), Ct);

        received.Should().Be(new ListTenantsFilter(1, 20, null, null, "code", "asc"));
    }

    [Fact]
    public async Task GetTenant_existente_devuelve_el_dto()
    {
        _store.Setup(s => s.GetAsync(TenantId, Ct)).ReturnsAsync(Tenant());

        var result = await new GetTenantQueryHandler(_store.Object).Handle(new GetTenantQuery(TenantId), Ct);

        result.Value.Version.Should().Be(3);
    }

    [Fact]
    public async Task GetTenant_inexistente_falla_con_tenant_not_found()
    {
        var result = await new GetTenantQueryHandler(_store.Object).Handle(new GetTenantQuery(TenantId), Ct);

        result.Error.Should().Be(DomainErrors.Tenant.NotFound);
    }

    [Fact]
    public async Task ListBranches_devuelve_las_sedes_con_el_filtro_pedido()
    {
        _store.Setup(s => s.GetAsync(TenantId, Ct)).ReturnsAsync(Tenant());
        _store.Setup(s => s.ListBranchesAsync(TenantId, BranchStatusFilter.Closed, Ct)).ReturnsAsync([Branch()]);

        var result = await new ListBranchesQueryHandler(_store.Object).Handle(new ListBranchesQuery(TenantId, BranchStatusFilter.Closed), Ct);

        result.Value.Should().ContainSingle().Which.Id.Should().Be(BranchId);
    }

    [Fact]
    public async Task ListBranches_de_tenant_inexistente_falla_con_tenant_not_found_sin_listar()
    {
        var result = await new ListBranchesQueryHandler(_store.Object).Handle(new ListBranchesQuery(TenantId), Ct);

        result.Error.Should().Be(DomainErrors.Tenant.NotFound);
        _store.Verify(s => s.ListBranchesAsync(It.IsAny<Guid>(), It.IsAny<BranchStatusFilter>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetBranch_existente_devuelve_el_dto()
    {
        _store.Setup(s => s.GetBranchAsync(TenantId, BranchId, Ct)).ReturnsAsync(Branch());

        var result = await new GetBranchQueryHandler(_store.Object).Handle(new GetBranchQuery(TenantId, BranchId), Ct);

        result.Value.TenantVersion.Should().Be(3);
    }

    [Fact]
    public async Task GetBranch_inexistente_en_tenant_existente_falla_con_branch_not_found()
    {
        _store.Setup(s => s.GetAsync(TenantId, Ct)).ReturnsAsync(Tenant());

        var result = await new GetBranchQueryHandler(_store.Object).Handle(new GetBranchQuery(TenantId, BranchId), Ct);

        result.Error.Should().Be(DomainErrors.Tenant.BranchNotFound);
    }

    [Fact]
    public async Task GetBranch_de_tenant_inexistente_falla_con_tenant_not_found()
    {
        var result = await new GetBranchQueryHandler(_store.Object).Handle(new GetBranchQuery(TenantId, BranchId), Ct);

        result.Error.Should().Be(DomainErrors.Tenant.NotFound);
    }
}
