namespace Mdm.Domain.Organization.Tenant.Branch;

/// <summary>Datos de alta de una sede dentro de su tenant.</summary>
internal sealed record BranchRegistration(Code Code, Name Name, ActorId CreatedBy);

/// <summary>Quién, cuándo y por qué de una transición del ciclo de vida de una sede.</summary>
internal readonly record struct BranchChange(ActorId Actor, string? Reason, DateTimeOffset At);

/// <summary>Foto persistida de una sede (ver <see cref="TenantSnapshot"/>).</summary>
public sealed record BranchSnapshot(
    Guid Id,
    Guid TenantId,
    string Code,
    string Name,
    bool IsActive,
    bool IsClosed,
    DateTimeOffset? ClosedAtUtc,
    string? ClosedBy,
    AuditProps Audit);
