namespace Mdm.Domain.Organization.Tenant.Events;

/// <summary>
/// Base de los eventos del agregado Tenant. Todos llevan la <c>Version</c> del agregado tras el
/// cambio: es la secuencia que el futuro <c>TenantEvent</c> publicará como <c>Sequence</c> para que
/// UMS descarte entregas fuera de orden. Hoy no se publican (outbox diferido).
/// </summary>
public abstract record TenantDomainEvent(Guid TenantId, long Version) : DomainEvent;

public sealed record TenantCreatedEvent(Guid TenantId, long Version, string Code, string Name) : TenantDomainEvent(TenantId, Version);

public sealed record TenantUpdatedEvent(Guid TenantId, long Version) : TenantDomainEvent(TenantId, Version);

public sealed record TenantSuspendedEvent(Guid TenantId, long Version) : TenantDomainEvent(TenantId, Version);

public sealed record TenantActivatedEvent(Guid TenantId, long Version) : TenantDomainEvent(TenantId, Version);

public sealed record TenantArchivedEvent(Guid TenantId, long Version) : TenantDomainEvent(TenantId, Version);

public sealed record BranchCreatedEvent(Guid TenantId, long Version, Guid BranchId, string Code) : TenantDomainEvent(TenantId, Version);

public sealed record BranchUpdatedEvent(Guid TenantId, long Version, Guid BranchId) : TenantDomainEvent(TenantId, Version);

public sealed record BranchDeactivatedEvent(Guid TenantId, long Version, Guid BranchId) : TenantDomainEvent(TenantId, Version);

public sealed record BranchReactivatedEvent(Guid TenantId, long Version, Guid BranchId) : TenantDomainEvent(TenantId, Version);

/// <summary>Cierre definitivo; lleva el código porque queda ocupado para siempre bajo el tenant.</summary>
public sealed record BranchClosedEvent(Guid TenantId, long Version, Guid BranchId, string Code) : TenantDomainEvent(TenantId, Version);
