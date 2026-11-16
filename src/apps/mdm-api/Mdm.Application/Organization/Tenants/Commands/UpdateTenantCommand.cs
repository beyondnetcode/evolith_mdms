namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Edita los datos generales; el código y la matriz no cambian. Devuelve la nueva versión.</summary>
public sealed record UpdateTenantCommand(
    Guid TenantId,
    long ExpectedVersion,
    string Name,
    string Type,
    string? CompanyReference = null) : ICommand<long>;
