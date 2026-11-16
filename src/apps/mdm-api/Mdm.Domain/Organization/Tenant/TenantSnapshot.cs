namespace Mdm.Domain.Organization.Tenant;

using Mdm.Domain.Organization.Tenant.Branch;

/// <summary>
/// Foto persistida de un tenant con sus sedes, en tipos primitivos. La infraestructura la arma
/// desde sus filas y <see cref="Tenant.Load"/> reconstruye el agregado sin reflexión y sin emitir
/// eventos. Los identificadores de las enumeraciones son los de <see cref="OrganizationType"/> y
/// <see cref="TenantStatus"/>.
/// </summary>
public sealed record TenantSnapshot(
    Guid Id,
    string Code,
    string Name,
    int OrganizationTypeId,
    string? CompanyReference,
    Guid? ParentTenantId,
    int StatusId,
    AuditProps Audit,
    long Version,
    IReadOnlyCollection<BranchSnapshot> Branches);
