namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Suspende un tenant activo (Active → Suspended). Devuelve la nueva versión del agregado.</summary>
public sealed record SuspendTenantCommand(Guid TenantId, long ExpectedVersion) : ICommand<long>;
