namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Pausa reversible de una sede activa. Devuelve la nueva versión del tenant.</summary>
public sealed record DeactivateBranchCommand(Guid TenantId, Guid BranchId, long ExpectedVersion, string? Reason = null) : ICommand<long>;
