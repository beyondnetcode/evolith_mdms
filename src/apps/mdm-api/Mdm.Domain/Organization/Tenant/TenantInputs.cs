namespace Mdm.Domain.Organization.Tenant;

/// <summary>
/// Datos de alta de un tenant. Objeto de parámetros: el umbral de ADR-0056 D4 (S107) admite como
/// máximo tres parámetros por método.
/// </summary>
/// <param name="Id">Identidad generada por la aplicación; si se omite, la genera el dominio.</param>
public sealed record NewTenant(
    Code Code,
    Name Name,
    OrganizationType Type,
    CompanyReference? CompanyReference = null,
    TenantId? ParentTenantId = null,
    TenantId? Id = null);

/// <summary>Datos generales editables de un tenant. El código y la matriz no están: no cambian.</summary>
public sealed record TenantGeneralData(Name Name, OrganizationType Type, CompanyReference? CompanyReference);
