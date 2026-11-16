namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;

internal sealed class ActivateTenantCommandHandler : ICommandHandler<ActivateTenantCommand, long>
{
    private readonly TenantMutationExecutor _executor;

    public ActivateTenantCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public Task<Result<long>> Handle(ActivateTenantCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) => tenant.Activate(actor),
            cancellationToken);
}
