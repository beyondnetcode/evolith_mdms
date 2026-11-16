namespace Mdm.Application.Organization.DTOs;

/// <summary>Vista de lectura de un tenant. <c>Version</c> es el token de concurrencia (ETag).</summary>
public sealed record TenantDto(
    Guid Id,
    string Code,
    string Name,
    string Type,
    string Status,
    Guid? ParentTenantId,
    string? CompanyReference,
    long Version,
    DateTimeOffset CreatedAt,
    string CreatedBy,
    DateTimeOffset? UpdatedAt,
    string? UpdatedBy);
