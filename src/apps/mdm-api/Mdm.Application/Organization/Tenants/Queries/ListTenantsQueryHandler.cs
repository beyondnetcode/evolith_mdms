namespace Mdm.Application.Organization.Tenants.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Common;
using Mdm.Application.Common.Validation;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.DTOs;
using Mdm.Domain.Kernel;

internal sealed class ListTenantsQueryHandler : IQueryHandler<ListTenantsQuery, PagedResult<TenantDto>>
{
    private readonly ITenantReadStore _store;

    public ListTenantsQueryHandler(ITenantReadStore store)
    {
        _store = store;
    }

    public async Task<Result<PagedResult<TenantDto>>> Handle(ListTenantsQuery request, CancellationToken cancellationToken)
    {
        // El store recibe el filtro ya normalizado: estado canónico, búsqueda recortada u omitida,
        // orden en minúsculas. Así la infraestructura no repite reglas de forma.
        var status = TenantStatuses.TryNormalize(request.Status, out var canonical) ? canonical : null;
        var search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim();
        var filter = new ListTenantsFilter(
            request.Page,
            request.PageSize,
            status,
            search,
            request.SortBy.Trim().ToLowerInvariant(),
            request.SortOrder.Trim().ToLowerInvariant());

        var page = await _store.ListAsync(filter, cancellationToken).ConfigureAwait(false);
        return Result<PagedResult<TenantDto>>.Success(page);
    }
}
