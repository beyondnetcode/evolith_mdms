namespace Mdm.Application.Test.Tenants;

using Mdm.Application.Organization.Tenants.Commands;
using Mdm.Application.Test.Support;
using Mdm.Domain.Kernel;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

public sealed class SuspendTenantHandlerTest : MutationHandlerTestBase<SuspendTenantCommand>
{
    protected override TenantAggregate ReadyTenant() => TenantMother.Active();

    protected override (TenantAggregate Tenant, string Error) FailingTenant() =>
        (TenantMother.Suspended(), DomainErrors.Tenant.AlreadySuspended);

    protected override SuspendTenantCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), expectedVersion);

    protected override Task<Result<long>> SendAsync(SuspendTenantCommand command) =>
        new SuspendTenantCommandHandler(Executor).Handle(command, CancellationToken.None);

    [Fact]
    public async Task Con_sedes_activas_falla_con_has_active_branches()
    {
        var tenant = TenantMother.WithBranch();
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, tenant.Version));

        result.Error.Should().Be(DomainErrors.Tenant.HasActiveBranches);
    }
}

public sealed class ActivateTenantHandlerTest : MutationHandlerTestBase<ActivateTenantCommand>
{
    protected override TenantAggregate ReadyTenant() => TenantMother.Suspended();

    protected override (TenantAggregate Tenant, string Error) FailingTenant() =>
        (TenantMother.Active(), DomainErrors.Tenant.AlreadyActive);

    protected override ActivateTenantCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), expectedVersion);

    protected override Task<Result<long>> SendAsync(ActivateTenantCommand command) =>
        new ActivateTenantCommandHandler(Executor).Handle(command, CancellationToken.None);
}

public sealed class ArchiveTenantHandlerTest : MutationHandlerTestBase<ArchiveTenantCommand>
{
    protected override TenantAggregate ReadyTenant() => TenantMother.Active();

    protected override (TenantAggregate Tenant, string Error) FailingTenant() =>
        (TenantMother.Archived(), DomainErrors.Tenant.Archived);

    protected override ArchiveTenantCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), expectedVersion);

    protected override Task<Result<long>> SendAsync(ArchiveTenantCommand command) =>
        new ArchiveTenantCommandHandler(Executor).Handle(command, CancellationToken.None);
}
