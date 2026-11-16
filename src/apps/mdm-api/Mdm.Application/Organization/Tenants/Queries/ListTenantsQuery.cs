namespace Mdm.Application.Organization.Tenants.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Common;
using Mdm.Application.Organization.DTOs;

/// <summary>
/// Listado paginado. <c>Status</c> es el nombre de <c>TenantStatus</c> (sin distinguir mayúsculas);
/// <c>SortBy</c> ∈ {code, name, createdAt} (sin distinguir mayúsculas); <c>SortOrder</c> ∈ {asc, desc}.
/// </summary>
public sealed record ListTenantsQuery(
    int Page = 1,
    int PageSize = 20,
    string? Status = null,
    string? Search = null,
    string SortBy = "code",
    string SortOrder = "asc") : IQuery<PagedResult<TenantDto>>;
