namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Archiva un tenant (terminal; el «borrado» lógico del maestro). Devuelve la nueva versión del agregado.</summary>
public sealed record ArchiveTenantCommand(Guid TenantId, long ExpectedVersion) : ICommand<long>;
