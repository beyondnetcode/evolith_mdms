namespace Mdm.Infrastructure.Persistence.Records;

/// <summary>Fila de <c>mdm.TenantBranches</c>. Sin versión propia: la concurrencia es la del tenant.</summary>
public sealed class TenantBranchRecord : AuditedRecord
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public TenantRecord? Tenant { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public bool IsClosed { get; set; }

    public DateTimeOffset? ClosedAt { get; set; }

    public string? ClosedBy { get; set; }
}
