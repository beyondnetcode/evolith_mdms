namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Cierre definitivo (terminal) de una sede. Devuelve la nueva versión del tenant.</summary>
public sealed record CloseBranchCommand(Guid TenantId, Guid BranchId, long ExpectedVersion, string? Reason = null) : ICommand<long>;
