namespace Mdm.Application.Test.Branches;

using Mdm.Application.Common.Exceptions;
using Mdm.Application.Organization.Branches.Commands;
using Mdm.Application.Test.Support;
using Mdm.Domain.Kernel;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

public sealed class AddBranchHandlerTest : HandlerFixture
{
    private Task<Result<AddBranchResult>> SendAsync(AddBranchCommand command) =>
        new AddBranchCommandHandler(Executor).Handle(command, CancellationToken.None);

    private static AddBranchCommand CommandFor(TenantAggregate tenant, string code = "lima") =>
        new(tenant.TenantId.GetValue(), tenant.Version, code, "Sede Lima");

    [Fact]
    public async Task Exito_devuelve_id_de_sede_y_nueva_version_del_tenant()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant));

        result.IsSuccess.Should().BeTrue(result.Error);
        result.Value.TenantVersion.Should().Be(2).And.Be(tenant.Version);
        result.Value.BranchId.Should().Be(TenantMother.FirstBranchId(tenant));
    }

    [Fact]
    public async Task Sin_usuario_falla_con_auth_user_required()
    {
        CurrentUser.SetupGet(u => u.ActorId).Returns((string?)null);
        var tenant = TenantMother.Active();
        Returns(tenant);

        (await SendAsync(CommandFor(tenant))).Error.Should().Be(Application.Common.ApplicationErrors.UserRequired);
    }

    [Fact]
    public async Task Tenant_inexistente_falla_con_tenant_not_found()
    {
        Returns(null);

        (await SendAsync(CommandFor(TenantMother.Active()))).Error.Should().Be(DomainErrors.Tenant.NotFound);
    }

    [Fact]
    public async Task Version_desfasada_falla_con_version_mismatch()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant) with { ExpectedVersion = 99 });

        result.Error.Should().Be(Application.Common.ApplicationErrors.VersionMismatch);
        tenant.Branches.Should().BeEmpty();
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Codigo_repetido_incluida_sede_cerrada_falla_con_branch_code_not_unique()
    {
        var tenant = TenantMother.WithBranch("LIMA");
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, "lima"));

        result.Error.Should().Be(DomainErrors.Tenant.BranchCodeNotUnique);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Tenant_suspendido_falla_con_not_active()
    {
        var tenant = TenantMother.Suspended();
        Returns(tenant);

        (await SendAsync(CommandFor(tenant))).Error.Should().Be(DomainErrors.Tenant.NotActive);
    }

    [Fact]
    public async Task Conflicto_de_version_al_guardar_se_traduce()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);
        SaveThrows(new ConcurrencyConflictException());

        (await SendAsync(CommandFor(tenant))).Error.Should().Be(Application.Common.ApplicationErrors.VersionMismatch);
    }

    [Fact]
    public async Task Carrera_de_codigo_de_sede_en_el_guardado_se_traduce_a_branch_code_not_unique()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);
        SaveThrows(new DuplicateKeyConflictException(DuplicateKeyConflictException.TenantBranchCode));

        (await SendAsync(CommandFor(tenant))).Error.Should().Be(DomainErrors.Tenant.BranchCodeNotUnique);
    }
}

public sealed class UpdateBranchHandlerTest : MutationHandlerTestBase<UpdateBranchCommand>
{
    protected override TenantAggregate ReadyTenant() => TenantMother.WithBranch();

    protected override (TenantAggregate Tenant, string Error) FailingTenant() =>
        (TenantMother.Archived(), DomainErrors.Tenant.Archived);

    protected override UpdateBranchCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), tenant.Branches.FirstOrDefault()?.BranchId.GetValue() ?? Guid.NewGuid(), expectedVersion, "Sede renombrada");

    protected override Task<Result<long>> SendAsync(UpdateBranchCommand command) =>
        new UpdateBranchCommandHandler(Executor).Handle(command, CancellationToken.None);

    [Fact]
    public async Task Sede_inexistente_falla_con_branch_not_found()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);

        (await SendAsync(CommandFor(tenant, tenant.Version))).Error.Should().Be(DomainErrors.Tenant.BranchNotFound);
    }
}

public sealed class DeactivateBranchHandlerTest : MutationHandlerTestBase<DeactivateBranchCommand>
{
    protected override TenantAggregate ReadyTenant() => TenantMother.WithBranch();

    protected override (TenantAggregate Tenant, string Error) FailingTenant()
    {
        var tenant = TenantMother.WithBranch();
        tenant.DeactivateBranch(tenant.Branches.First().BranchId, TenantMother.Actor).IsSuccess.Should().BeTrue();
        tenant.MarkAsPersisted();
        return (tenant, DomainErrors.Tenant.BranchAlreadyInactive);
    }

    protected override DeactivateBranchCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), TenantMother.FirstBranchId(tenant), expectedVersion, "mantenimiento");

    protected override Task<Result<long>> SendAsync(DeactivateBranchCommand command) =>
        new DeactivateBranchCommandHandler(Executor).Handle(command, CancellationToken.None);
}

public sealed class ReactivateBranchHandlerTest : MutationHandlerTestBase<ReactivateBranchCommand>
{
    protected override TenantAggregate ReadyTenant()
    {
        var tenant = TenantMother.WithBranch();
        tenant.DeactivateBranch(tenant.Branches.First().BranchId, TenantMother.Actor).IsSuccess.Should().BeTrue();
        tenant.MarkAsPersisted();
        return tenant;
    }

    protected override (TenantAggregate Tenant, string Error) FailingTenant() =>
        (TenantMother.WithBranch(), DomainErrors.Tenant.BranchAlreadyActive);

    protected override ReactivateBranchCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), TenantMother.FirstBranchId(tenant), expectedVersion);

    protected override Task<Result<long>> SendAsync(ReactivateBranchCommand command) =>
        new ReactivateBranchCommandHandler(Executor).Handle(command, CancellationToken.None);
}

public sealed class CloseBranchHandlerTest : MutationHandlerTestBase<CloseBranchCommand>
{
    protected override TenantAggregate ReadyTenant() => TenantMother.WithBranch();

    protected override (TenantAggregate Tenant, string Error) FailingTenant()
    {
        var tenant = TenantMother.WithBranch();
        tenant.CloseBranch(tenant.Branches.First().BranchId, TenantMother.Actor).IsSuccess.Should().BeTrue();
        tenant.MarkAsPersisted();
        return (tenant, DomainErrors.Tenant.BranchClosed);
    }

    protected override CloseBranchCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), TenantMother.FirstBranchId(tenant), expectedVersion);

    protected override Task<Result<long>> SendAsync(CloseBranchCommand command) =>
        new CloseBranchCommandHandler(Executor).Handle(command, CancellationToken.None);

    [Fact]
    public async Task Cierre_con_motivo_queda_en_la_bitacora_pendiente()
    {
        var tenant = TenantMother.WithBranch();
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, tenant.Version) with { Reason = "  cierre de plaza  " });

        result.IsSuccess.Should().BeTrue(result.Error);
        tenant.Branches.First().IsClosed.Should().BeTrue();
        tenant.PendingBranchLifecycleEntries.Should().Contain(e => e.Reason == "cierre de plaza");
    }
}
