namespace Mdm.Application.Organization.Tenants.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>
/// Alta de un tenant. <c>Type</c> es el nombre de <c>OrganizationType</c> (INTERNAL, SUPPLIER,
/// CLIENT; sin distinguir mayúsculas). <c>Id</c> es opcional: permite importar ids de UMS.
/// </summary>
public sealed record CreateTenantCommand(
    string Code,
    string Name,
    string Type,
    string? CompanyReference = null,
    Guid? ParentTenantId = null,
    Guid? Id = null) : ICommand<CreateTenantResult>;

/// <summary>Identidad y versión inicial del tenant creado.</summary>
public sealed record CreateTenantResult(Guid Id, long Version);
