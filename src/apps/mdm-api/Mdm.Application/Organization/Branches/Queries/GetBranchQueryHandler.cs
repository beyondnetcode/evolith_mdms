namespace Mdm.Application.Organization.Branches.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.DTOs;
using Mdm.Domain.Kernel;

internal sealed class GetBranchQueryHandler : IQueryHandler<GetBranchQuery, BranchDto>
{
    private readonly ITenantReadStore _store;

    public GetBranchQueryHandler(ITenantReadStore store)
    {
        _store = store;
    }

    public async Task<Result<BranchDto>> Handle(GetBranchQuery request, CancellationToken cancellationToken)
    {
        var branch = await _store.GetBranchAsync(request.TenantId, request.BranchId, cancellationToken).ConfigureAwait(false);
        if (branch is not null)
        {
            return Result<BranchDto>.Success(branch);
        }

        // Distingue «no existe el tenant» de «no existe la sede» para que el cliente sepa qué corregir.
        var tenantExists = await _store.GetAsync(request.TenantId, cancellationToken).ConfigureAwait(false) is not null;
        return Result<BranchDto>.Failure(tenantExists ? DomainErrors.Tenant.BranchNotFound : DomainErrors.Tenant.NotFound);
    }
}
