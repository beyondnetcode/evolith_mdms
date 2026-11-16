namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Edita el nombre de una sede (el código no cambia). Devuelve la nueva versión del tenant.</summary>
public sealed record UpdateBranchCommand(Guid TenantId, Guid BranchId, long ExpectedVersion, string Name) : ICommand<long>;
