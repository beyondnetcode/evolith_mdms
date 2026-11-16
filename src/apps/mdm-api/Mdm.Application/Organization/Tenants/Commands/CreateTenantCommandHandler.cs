namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Common;
using Mdm.Application.Common.Validation;
using Mdm.Application.Organization.Abstractions;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

internal sealed class CreateTenantCommandHandler : ICommandHandler<CreateTenantCommand, CreateTenantResult>
{
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUser _currentUser;

    public CreateTenantCommandHandler(ITenantRepository tenants, IUnitOfWork unitOfWork, ICurrentUser currentUser)
    {
        _tenants = tenants;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public async Task<Result<CreateTenantResult>> Handle(CreateTenantCommand request, CancellationToken cancellationToken)
    {
        var actor = TenantMutationExecutor.ActorOf(_currentUser);
        if (actor.IsFailure)
        {
            return Result<CreateTenantResult>.Failure(actor.Error);
        }

        if (!OrganizationTypes.TryParse(request.Type, out var type))
        {
            return Result<CreateTenantResult>.Failure(ApplicationErrors.Validation.OrganizationTypeInvalid);
        }

        var companyReference = request.CompanyReference is null ? null : CompanyReference.Create(request.CompanyReference);
        var parentId = request.ParentTenantId is { } parent ? TenantId.Load(parent) : null;
        var data = new NewTenant(
            Code.Create(request.Code),
            Name.Create(request.Name),
            type,
            companyReference,
            parentId,
            request.Id is { } id ? TenantId.Load(id) : null);

        var created = TenantAggregate.Create(data, actor.Value);
        if (created.IsFailure)
        {
            return Result<CreateTenantResult>.Failure(created.Error);
        }

        var uniqueness = await CheckUniquenessAsync(data, cancellationToken).ConfigureAwait(false);
        if (uniqueness.IsFailure)
        {
            return Result<CreateTenantResult>.Failure(uniqueness.Error);
        }

        var tenant = created.Value;
        await _tenants.AddAsync(tenant, cancellationToken).ConfigureAwait(false);
        var saved = await _unitOfWork.TrySaveAsync(cancellationToken).ConfigureAwait(false);
        return saved.IsFailure
            ? Result<CreateTenantResult>.Failure(saved.Error)
            : Result<CreateTenantResult>.Success(new CreateTenantResult(tenant.TenantId.GetValue(), tenant.Version));
    }

    /// <summary>
    /// Verificación previa para dar el error exacto en el caso común; la carrera residual entre esta
    /// lectura y el INSERT la cierra el índice único, que <c>TrySaveAsync</c> traduce al mismo código.
    /// </summary>
    private async Task<Result> CheckUniquenessAsync(NewTenant data, CancellationToken ct)
    {
        if (await _tenants.CodeExistsAsync(data.Code, ct).ConfigureAwait(false))
        {
            return Result.Failure(DomainErrors.Tenant.CodeNotUnique);
        }

        if (data.CompanyReference is not null
            && await _tenants.CompanyReferenceExistsAsync(data.CompanyReference, null, ct).ConfigureAwait(false))
        {
            return Result.Failure(DomainErrors.Tenant.CompanyReferenceNotUnique);
        }

        return data.ParentTenantId is null
            ? Result.Success()
            : await CheckParentAsync(data.ParentTenantId, ct).ConfigureAwait(false);
    }

    /// <summary>El padre debe existir y no estar archivado: un archivado es de solo lectura.</summary>
    private async Task<Result> CheckParentAsync(TenantId parentId, CancellationToken ct)
    {
        var parent = await _tenants.GetByIdAsync(parentId, ct).ConfigureAwait(false);
        if (parent is null)
        {
            return Result.Failure(DomainErrors.Tenant.ParentInvalid);
        }

        return parent.Status == TenantStatus.Archived
            ? Result.Failure(DomainErrors.Tenant.ParentArchived)
            : Result.Success();
    }
}
