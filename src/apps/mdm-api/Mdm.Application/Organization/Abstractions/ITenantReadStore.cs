namespace Mdm.Application.Organization.Abstractions;

using Mdm.Application.Common;
using Mdm.Application.Organization.DTOs;

/// <summary>
/// Puerto de LECTURA (CQRS): resuelve listados y consultas con proyecciones, sin cargar agregados.
/// La escritura usa <c>ITenantRepository</c> del dominio.
/// </summary>
public interface ITenantReadStore
{
    Task<PagedResult<TenantDto>> ListAsync(ListTenantsFilter f, CancellationToken ct);

    Task<TenantDto?> GetAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<BranchDto>> ListBranchesAsync(Guid tenantId, BranchStatusFilter status, CancellationToken ct);

    Task<BranchDto?> GetBranchAsync(Guid tenantId, Guid branchId, CancellationToken ct);
}
