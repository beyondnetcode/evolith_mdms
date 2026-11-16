using Microsoft.EntityFrameworkCore;
using Mdm.Application.Common;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.DTOs;
using Mdm.Domain.Organization.Tenant;
using Mdm.Infrastructure.Persistence.Records;
using Unimar.Shells.Net.Ddd;

namespace Mdm.Infrastructure.Persistence;

/// <summary>
/// Almacén de lectura (CQRS): proyecta directo desde las tablas, sin rastreo y sin cargar el
/// agregado. Un listado de 100 organizaciones es una consulta de conteo y otra de página, no cien
/// agregados rehidratados.
/// </summary>
public sealed class TenantReadStore(MdmDbContext dbContext) : ITenantReadStore
{
    private const string SortByName = "name";
    private const string SortByCreatedAt = "createdat";
    private const string SortDescending = "desc";

    public async Task<PagedResult<TenantDto>> ListAsync(ListTenantsFilter f, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(f);
        var query = dbContext.Tenants.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            var status = EnumerationByName<TenantStatus>(f.Status);
            if (status is null)
            {
                // Un estado que no existe no coincide con ninguna fila; no es un error de lectura.
                return new PagedResult<TenantDto>([], f.Page, f.PageSize, 0);
            }

            var statusId = status.Id;
            query = query.Where(t => t.StatusId == statusId);
        }

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var term = f.Search.Trim();
            query = query.Where(t => t.Code.Contains(term) || t.Name.Contains(term));
        }

        var total = await query.CountAsync(ct).ConfigureAwait(false);
        var rows = await Order(query, f)
            .Skip((f.Page - 1) * f.PageSize)
            .Take(f.PageSize)
            .Select(t => new TenantRow(
                t.Id, t.Code, t.Name, t.OrganizationTypeId, t.StatusId, t.ParentTenantId,
                t.CompanyReference, t.Version, t.CreatedAt, t.CreatedBy, t.UpdatedAt, t.UpdatedBy))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return new PagedResult<TenantDto>(rows.Select(ToDto).ToList(), f.Page, f.PageSize, total);
    }

    public async Task<TenantDto?> GetAsync(Guid id, CancellationToken ct)
    {
        var row = await dbContext.Tenants.AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new TenantRow(
                t.Id, t.Code, t.Name, t.OrganizationTypeId, t.StatusId, t.ParentTenantId,
                t.CompanyReference, t.Version, t.CreatedAt, t.CreatedBy, t.UpdatedAt, t.UpdatedBy))
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);
        return row is null ? null : ToDto(row);
    }

    public async Task<IReadOnlyList<BranchDto>> ListBranchesAsync(Guid tenantId, BranchStatusFilter status, CancellationToken ct)
    {
        var branches = dbContext.TenantBranches.AsNoTracking().Where(b => b.TenantId == tenantId);
        branches = status switch
        {
            BranchStatusFilter.Active => branches.Where(b => b.IsActive && !b.IsClosed),
            BranchStatusFilter.Inactive => branches.Where(b => !b.IsActive && !b.IsClosed),
            BranchStatusFilter.Closed => branches.Where(b => b.IsClosed),
            _ => branches,
        };

        return await ProjectBranches(branches.OrderBy(b => b.Code).ThenBy(b => b.Id))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<BranchDto?> GetBranchAsync(Guid tenantId, Guid branchId, CancellationToken ct) =>
        ProjectBranches(dbContext.TenantBranches.AsNoTracking().Where(b => b.TenantId == tenantId && b.Id == branchId))
            .FirstOrDefaultAsync(ct);

    // La sede no tiene versión propia: su ETag es la del tenant, que se lee en la misma consulta.
    private static IQueryable<BranchDto> ProjectBranches(IQueryable<TenantBranchRecord> branches) =>
        branches.Select(b => new BranchDto(
            b.Id, b.TenantId, b.Code, b.Name, b.IsActive, b.IsClosed, b.ClosedAt, b.ClosedBy, b.Tenant!.Version));

    // Desempate por Id: sin él, dos filas con el mismo valor de orden pueden repetirse u omitirse
    // entre páginas.
    private static IOrderedQueryable<TenantRecord> Order(IQueryable<TenantRecord> query, ListTenantsFilter f)
    {
        var descending = string.Equals(f.SortOrder, SortDescending, StringComparison.OrdinalIgnoreCase);
        return f.SortBy.Trim().ToLowerInvariant() switch
        {
            SortByName => descending
                ? query.OrderByDescending(t => t.Name).ThenByDescending(t => t.Id)
                : query.OrderBy(t => t.Name).ThenBy(t => t.Id),
            SortByCreatedAt => descending
                ? query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id)
                : query.OrderBy(t => t.CreatedAt).ThenBy(t => t.Id),
            _ => descending
                ? query.OrderByDescending(t => t.Code).ThenByDescending(t => t.Id)
                : query.OrderBy(t => t.Code).ThenBy(t => t.Id),
        };
    }

    private static T? EnumerationByName<T>(string name)
        where T : DomainEnumeration =>
        DomainEnumeration.GetAll<T>().FirstOrDefault(e => string.Equals(e.Name, name.Trim(), StringComparison.OrdinalIgnoreCase));

    private static TenantDto ToDto(TenantRow row) => new(
        row.Id,
        row.Code,
        row.Name,
        DomainEnumeration.FromValue<OrganizationType>(row.OrganizationTypeId)?.Name ?? row.OrganizationTypeId.ToString(System.Globalization.CultureInfo.InvariantCulture),
        DomainEnumeration.FromValue<TenantStatus>(row.StatusId)?.Name ?? row.StatusId.ToString(System.Globalization.CultureInfo.InvariantCulture),
        row.ParentTenantId,
        row.CompanyReference,
        row.Version,
        row.CreatedAt,
        row.CreatedBy,
        row.UpdatedAt,
        row.UpdatedBy);

    private sealed record TenantRow(
        Guid Id,
        string Code,
        string Name,
        int OrganizationTypeId,
        int StatusId,
        Guid? ParentTenantId,
        string? CompanyReference,
        long Version,
        DateTimeOffset CreatedAt,
        string CreatedBy,
        DateTimeOffset? UpdatedAt,
        string? UpdatedBy);
}
