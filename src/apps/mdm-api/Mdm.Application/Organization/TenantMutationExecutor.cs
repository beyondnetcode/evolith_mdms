namespace Mdm.Application.Organization;

using Mdm.Application.Common;
using Mdm.Application.Organization.Abstractions;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

/// <summary>Qué agregado se modifica y con qué versión esperaba verlo el cliente (If-Match).</summary>
internal readonly record struct TenantMutation(Guid TenantId, long ExpectedVersion);

/// <summary>
/// Secuencia común de todo comando que modifica un tenant o sus sedes: actor autenticado, carga,
/// control de versión, verbo de dominio, persistencia y traducción de conflictos. Devuelve la NUEVA
/// versión del agregado. Cada paso que falla corta con su código estable y no toca nada más.
/// </summary>
internal sealed class TenantMutationExecutor
{
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUser _currentUser;

    public TenantMutationExecutor(ITenantRepository tenants, IUnitOfWork unitOfWork, ICurrentUser currentUser)
    {
        _tenants = tenants;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public Task<Result<long>> ExecuteAsync(
        TenantMutation mutation,
        Func<TenantAggregate, ActorId, Result> operation,
        CancellationToken ct) =>
        ExecuteAsync(mutation, (tenant, actor) => Task.FromResult(operation(tenant, actor)), ct);

    public async Task<Result<long>> ExecuteAsync(
        TenantMutation mutation,
        Func<TenantAggregate, ActorId, Task<Result>> operation,
        CancellationToken ct)
    {
        var actor = ActorOf(_currentUser);
        if (actor.IsFailure)
        {
            return Result<long>.Failure(actor.Error);
        }

        var tenant = await _tenants.GetByIdAsync(TenantId.Load(mutation.TenantId), ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result<long>.Failure(DomainErrors.Tenant.NotFound);
        }

        if (tenant.Version != mutation.ExpectedVersion)
        {
            return Result<long>.Failure(ApplicationErrors.VersionMismatch);
        }

        var outcome = await operation(tenant, actor.Value).ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result<long>.Failure(outcome.Error);
        }

        await _tenants.UpdateAsync(tenant, ct).ConfigureAwait(false);
        var saved = await _unitOfWork.TrySaveAsync(ct).ConfigureAwait(false);
        return saved.IsFailure ? Result<long>.Failure(saved.Error) : Result<long>.Success(tenant.Version);
    }

    /// <summary>Actor de la petición, o <c>auth.user_required</c> si no hay sesión.</summary>
    public static Result<ActorId> ActorOf(ICurrentUser currentUser)
    {
        var id = currentUser.ActorId;
        return string.IsNullOrWhiteSpace(id)
            ? Result<ActorId>.Failure(ApplicationErrors.UserRequired)
            : Result<ActorId>.Success(ActorId.Create(id));
    }
}
