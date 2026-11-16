namespace Mdm.Application.Organization.Branches.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.DTOs;
using Mdm.Domain.Kernel;

internal sealed class ListBranchesQueryHandler : IQueryHandler<ListBranchesQuery, IReadOnlyList<BranchDto>>
{
    private readonly ITenantReadStore _store;

    public ListBranchesQueryHandler(ITenantReadStore store)
    {
        _store = store;
    }

    public async Task<Result<IReadOnlyList<BranchDto>>> Handle(ListBranchesQuery request, CancellationToken cancellationToken)
    {
        if (await _store.GetAsync(request.TenantId, cancellationToken).ConfigureAwait(false) is null)
        {
            return Result<IReadOnlyList<BranchDto>>.Failure(DomainErrors.Tenant.NotFound);
        }

        var branches = await _store.ListBranchesAsync(request.TenantId, request.Status, cancellationToken).ConfigureAwait(false);
        return Result<IReadOnlyList<BranchDto>>.Success(branches);
    }
}
