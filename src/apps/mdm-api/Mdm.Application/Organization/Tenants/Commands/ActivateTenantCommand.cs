namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Reactiva un tenant suspendido (Suspended → Active). Devuelve la nueva versión del agregado.</summary>
public sealed record ActivateTenantCommand(Guid TenantId, long ExpectedVersion) : ICommand<long>;
