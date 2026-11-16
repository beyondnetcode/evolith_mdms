namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;

internal sealed class CloseBranchCommandHandler : ICommandHandler<CloseBranchCommand, long>
{
    private readonly TenantMutationExecutor _executor;

    public CloseBranchCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public Task<Result<long>> Handle(CloseBranchCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) => tenant.CloseBranch(BranchId.Load(request.BranchId), actor, request.Reason),
            cancellationToken);
}
