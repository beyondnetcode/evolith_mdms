namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Common;
using Mdm.Application.Common.Validation;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

internal sealed class UpdateTenantCommandHandler : ICommandHandler<UpdateTenantCommand, long>
{
    private readonly TenantMutationExecutor _executor;
    private readonly ITenantRepository _tenants;

    public UpdateTenantCommandHandler(TenantMutationExecutor executor, ITenantRepository tenants)
    {
        _executor = executor;
        _tenants = tenants;
    }

    public Task<Result<long>> Handle(UpdateTenantCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            async (tenant, actor) => await ApplyAsync(request, (tenant, actor), cancellationToken).ConfigureAwait(false),
            cancellationToken);

    private async Task<Result> ApplyAsync(
        UpdateTenantCommand request,
        (TenantAggregate Tenant, ActorId Actor) context,
        CancellationToken ct)
    {
        var (tenant, actor) = context;
        if (!OrganizationTypes.TryParse(request.Type, out var type))
        {
            return Result.Failure(ApplicationErrors.Validation.OrganizationTypeInvalid);
        }

        var companyReference = request.CompanyReference is null ? null : CompanyReference.Create(request.CompanyReference);
        if (companyReference is not null
            && await _tenants.CompanyReferenceExistsAsync(companyReference, tenant.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure(DomainErrors.Tenant.CompanyReferenceNotUnique);
        }

        return tenant.UpdateGeneralData(new TenantGeneralData(Name.Create(request.Name), type, companyReference), actor);
    }
}
