namespace Mdm.Application.Organization.Tenants.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.DTOs;
using Mdm.Domain.Kernel;

internal sealed class GetTenantQueryHandler : IQueryHandler<GetTenantQuery, TenantDto>
{
    private readonly ITenantReadStore _store;

    public GetTenantQueryHandler(ITenantReadStore store)
    {
        _store = store;
    }

    public async Task<Result<TenantDto>> Handle(GetTenantQuery request, CancellationToken cancellationToken)
    {
        var tenant = await _store.GetAsync(request.Id, cancellationToken).ConfigureAwait(false);
        return tenant is null
            ? Result<TenantDto>.Failure(DomainErrors.Tenant.NotFound)
            : Result<TenantDto>.Success(tenant);
    }
}
