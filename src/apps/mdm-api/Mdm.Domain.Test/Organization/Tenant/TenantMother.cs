namespace Mdm.Domain.Test.Organization.Tenant;

using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

/// <summary>Fábrica de tenants válidos para las pruebas.</summary>
internal static class TenantMother
{
    public static readonly ActorId Actor = ActorId.Create("usuario-001");

    public static NewTenant NewTenantData(string code = "ORG", TenantId? id = null) =>
        new(Code.Create(code), Name.Create("Organización S.A."), OrganizationType.INTERNAL, CompanyReference.Create("20100412447"), Id: id);

    public static TenantAggregate Active(string code = "ORG")
    {
        var tenant = TenantAggregate.Create(NewTenantData(code), Actor).Value;
        tenant.MarkAsPersisted();
        return tenant;
    }

    public static Guid AddBranch(TenantAggregate tenant, string code = "LIMA")
    {
        var branch = tenant.AddBranch(Code.Create(code), Name.Create($"Sede {code}"), Actor).Value;
        return branch.BranchId.GetValue();
    }
}
