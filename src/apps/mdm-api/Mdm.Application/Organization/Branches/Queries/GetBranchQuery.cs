namespace Mdm.Application.Organization.Branches.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Organization.DTOs;

public sealed record GetBranchQuery(Guid TenantId, Guid BranchId) : IQuery<BranchDto>;
