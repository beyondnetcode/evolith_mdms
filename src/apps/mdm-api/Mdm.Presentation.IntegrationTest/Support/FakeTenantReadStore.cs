using Mdm.Application.Common;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.DTOs;

namespace Mdm.Presentation.IntegrationTest.Support;

/// <summary>Almacén de lectura en memoria: una organización fija y ninguna sede. No hay base de datos.</summary>
internal sealed class FakeTenantReadStore : ITenantReadStore
{
    public static readonly Guid KnownTenantId = Guid.Parse("0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11");

    public const long KnownVersion = 7;

    private static readonly TenantDto Known = new(
        KnownTenantId, "ORG", "Organización S.A.", "INTERNAL", "Active", null, "20100412447",
        KnownVersion, new DateTimeOffset(2026, 10, 21, 15, 4, 5, 100, TimeSpan.Zero), "usuario-001", null, null);

    public Task<PagedResult<TenantDto>> ListAsync(ListTenantsFilter f, CancellationToken ct) =>
        Task.FromResult(new PagedResult<TenantDto>([Known], 1, 20, 1));

    public Task<TenantDto?> GetAsync(Guid id, CancellationToken ct) =>
        Task.FromResult(id == KnownTenantId ? Known : null);

    public Task<IReadOnlyList<BranchDto>> ListBranchesAsync(Guid tenantId, BranchStatusFilter status, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<BranchDto>>([]);

    public Task<BranchDto?> GetBranchAsync(Guid tenantId, Guid branchId, CancellationToken ct) =>
        Task.FromResult<BranchDto?>(null);
}
