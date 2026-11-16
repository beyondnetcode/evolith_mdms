namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;

internal sealed class UpdateBranchCommandHandler : ICommandHandler<UpdateBranchCommand, long>
{
    private readonly TenantMutationExecutor _executor;

    public UpdateBranchCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public Task<Result<long>> Handle(UpdateBranchCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) => tenant.UpdateBranch(BranchId.Load(request.BranchId), Name.Create(request.Name), actor),
            cancellationToken);
}
