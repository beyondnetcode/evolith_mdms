namespace Mdm.Application.Common;

/// <summary>Página de resultados con paginación por desplazamiento.</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);
