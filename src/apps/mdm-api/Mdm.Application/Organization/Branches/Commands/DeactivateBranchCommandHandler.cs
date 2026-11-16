namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;

internal sealed class DeactivateBranchCommandHandler : ICommandHandler<DeactivateBranchCommand, long>
{
    private readonly TenantMutationExecutor _executor;

    public DeactivateBranchCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public Task<Result<long>> Handle(DeactivateBranchCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) => tenant.DeactivateBranch(BranchId.Load(request.BranchId), actor, request.Reason),
            cancellationToken);
}
