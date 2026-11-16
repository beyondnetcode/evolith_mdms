namespace Mdm.Infrastructure.Persistence.Records;

/// <summary>Fila de <c>mdm.BranchLifecycleEntries</c>: bitácora append-only (MDM-001 D6).</summary>
public sealed class BranchLifecycleEntryRecord
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid BranchId { get; set; }

    public int EpisodeId { get; set; }

    public DateTimeOffset OccurredAt { get; set; }

    public string ActorId { get; set; } = string.Empty;

    public string NameSnapshot { get; set; } = string.Empty;

    public string? Reason { get; set; }
}
