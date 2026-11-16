namespace Mdm.Application.Organization.DTOs;

/// <summary>
/// Vista de lectura de una sede. <c>TenantVersion</c> es la versión del agregado Tenant: la sede no
/// tiene concurrencia propia y su ETag es la del tenant.
/// </summary>
public sealed record BranchDto(
    Guid Id,
    Guid TenantId,
    string Code,
    string Name,
    bool IsActive,
    bool IsClosed,
    DateTimeOffset? ClosedAt,
    string? ClosedBy,
    long TenantVersion);
