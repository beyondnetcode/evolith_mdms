namespace Mdm.Application.Organization.Tenants.Queries;

using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Organization.DTOs;

public sealed record GetTenantQuery(Guid Id) : IQuery<TenantDto>;
