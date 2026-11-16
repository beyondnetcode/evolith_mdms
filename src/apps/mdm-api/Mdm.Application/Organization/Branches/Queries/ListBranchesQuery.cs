namespace Mdm.Application.Organization.Branches.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Organization.DTOs;

/// <summary>Sedes de un tenant. Sin filtro de estado devuelve todas, incluidas las cerradas.</summary>
public sealed record ListBranchesQuery(Guid TenantId, BranchStatusFilter Status = BranchStatusFilter.All)
    : IQuery<IReadOnlyList<BranchDto>>;
