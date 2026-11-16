namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;

internal sealed class ReactivateBranchCommandHandler : ICommandHandler<ReactivateBranchCommand, long>
{
    private readonly TenantMutationExecutor _executor;

    public ReactivateBranchCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public Task<Result<long>> Handle(ReactivateBranchCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) => tenant.ReactivateBranch(BranchId.Load(request.BranchId), actor, request.Reason),
            cancellationToken);
}
