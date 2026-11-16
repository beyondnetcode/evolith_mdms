namespace Mdm.Application.Organization.DTOs;

/// <summary>Filtro, orden y paginación del listado de tenants, ya validados y normalizados.</summary>
public sealed record ListTenantsFilter(int Page, int PageSize, string? Status, string? Search, string SortBy, string SortOrder);
