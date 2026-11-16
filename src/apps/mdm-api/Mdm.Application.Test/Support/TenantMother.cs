namespace Mdm.Application.Test.Support;

using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

/// <summary>Tenants válidos ya «persistidos» (versión base limpia) para armar escenarios de handlers.</summary>
internal static class TenantMother
{
    public const string ActorName = "usuario-001";

    public static readonly ActorId Actor = ActorId.Create(ActorName);

    public static TenantAggregate Active(string code = "ORG")
    {
        var data = new NewTenant(
            Code.Create(code), Name.Create("Organización S.A."), OrganizationType.INTERNAL, CompanyReference.Create("20100412447"));
        var tenant = TenantAggregate.Create(data, Actor).Value;
        tenant.MarkAsPersisted();
        return tenant;
    }

    public static TenantAggregate WithBranch(string branchCode = "LIMA")
    {
        var tenant = Active();
        tenant.AddBranch(Code.Create(branchCode), Name.Create($"Sede {branchCode}"), Actor).IsSuccess.Should().BeTrue();
        tenant.MarkAsPersisted();
        return tenant;
    }

    public static Guid FirstBranchId(TenantAggregate tenant) => tenant.Branches.First().BranchId.GetValue();

    public static TenantAggregate Suspended()
    {
        var tenant = Active();
        tenant.Suspend(Actor).IsSuccess.Should().BeTrue();
        tenant.MarkAsPersisted();
        return tenant;
    }

    public static TenantAggregate Archived()
    {
        var tenant = Active();
        tenant.Archive(Actor).IsSuccess.Should().BeTrue();
        tenant.MarkAsPersisted();
        return tenant;
    }
}
