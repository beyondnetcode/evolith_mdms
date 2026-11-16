namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;

internal sealed class AddBranchCommandHandler : ICommandHandler<AddBranchCommand, AddBranchResult>
{
    private readonly TenantMutationExecutor _executor;

    public AddBranchCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public async Task<Result<AddBranchResult>> Handle(AddBranchCommand request, CancellationToken cancellationToken)
    {
        var branchId = Guid.Empty;
        var version = await _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) =>
            {
                var added = tenant.AddBranch(Code.Create(request.Code), Name.Create(request.Name), actor);
                if (added.IsFailure)
                {
                    return Result.Failure(added.Error);
                }

                branchId = added.Value.BranchId.GetValue();
                return Result.Success();
            },
            cancellationToken).ConfigureAwait(false);

        return version.IsFailure
            ? Result<AddBranchResult>.Failure(version.Error)
            : Result<AddBranchResult>.Success(new AddBranchResult(branchId, version.Value));
    }
}
