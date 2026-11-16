namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Domain.Kernel;

internal sealed class ArchiveTenantCommandHandler : ICommandHandler<ArchiveTenantCommand, long>
{
    private readonly TenantMutationExecutor _executor;

    public ArchiveTenantCommandHandler(TenantMutationExecutor executor)
    {
        _executor = executor;
    }

    public Task<Result<long>> Handle(ArchiveTenantCommand request, CancellationToken cancellationToken) =>
        _executor.ExecuteAsync(
            new TenantMutation(request.TenantId, request.ExpectedVersion),
            (tenant, actor) => tenant.Archive(actor),
            cancellationToken);
}
