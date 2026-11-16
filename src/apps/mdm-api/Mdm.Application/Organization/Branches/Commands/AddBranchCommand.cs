namespace Mdm.Application.Organization.Branches.Commands;

using Mdm.Application.Abstractions.Messaging;

/// <summary>Alta de una sede en un tenant activo. El código es único por tenant, incluidas las sedes cerradas.</summary>
public sealed record AddBranchCommand(Guid TenantId, long ExpectedVersion, string Code, string Name) : ICommand<AddBranchResult>;

/// <summary>Identidad de la sede creada y nueva versión del tenant (ETag).</summary>
public sealed record AddBranchResult(Guid BranchId, long TenantVersion);
