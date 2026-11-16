namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;

internal sealed class SuspendTenantCommandHandler : ICommandHandler<SuspendTenantCommand, long>
{
    private readonly TenantMutationExecutor _executor;

    public SuspendTenantCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public Task<Result<long>> Handle(SuspendTenantCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) => tenant.Suspend(actor),
            cancellationToken);
}
