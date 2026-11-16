namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Vuelve a poner en servicio una sede inactiva. Devuelve la nueva versión del tenant.</summary>
public sealed record ReactivateBranchCommand(Guid TenantId, Guid BranchId, long ExpectedVersion, string? Reason = null) : ICommand<long>;
