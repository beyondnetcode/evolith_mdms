using Mdm.Domain.Organization.Tenant;
using Mdm.Domain.Organization.Tenant.Branch;
using Mdm.Infrastructure.Persistence.Records;
using Unimar.Shells.Net.Ddd.ValueObjects.Audit;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

namespace Mdm.Infrastructure.Persistence;

/// <summary>
/// Traducción entre el agregado <c>Tenant</c> y sus filas. Es el único sitio que conoce las dos
/// formas; el repositorio y el almacén de lectura no se mezclan con ella.
/// </summary>
internal static class TenantRecordMapper
{
    /// <summary>Fila hacia foto del dominio, lista para <c>Tenant.Load</c>.</summary>
    public static TenantSnapshot ToSnapshot(TenantRecord record) => new(
        record.Id,
        record.Code,
        record.Name,
        record.OrganizationTypeId,
        record.CompanyReference,
        record.ParentTenantId,
        record.StatusId,
        ToAuditProps(record),
        record.Version,
        record.Branches.Select(ToSnapshot).ToList());

    public static BranchSnapshot ToSnapshot(TenantBranchRecord record) => new(
        record.Id,
        record.TenantId,
        record.Code,
        record.Name,
        record.IsActive,
        record.IsClosed,
        record.ClosedAt,
        record.ClosedBy,
        ToAuditProps(record));

    /// <summary>Agregado nuevo hacia su fila completa, con todas sus sedes.</summary>
    public static TenantRecord ToRecord(TenantAggregate tenant)
    {
        var record = new TenantRecord
        {
            Id = tenant.TenantId.GetValue(),
            Code = tenant.Code.GetValue(),
        };
        ApplyTo(tenant, record);
        record.Branches.AddRange(tenant.Branches.Select(ToBranchRecord));
        return record;
    }

    /// <summary>
    /// Vuelca el estado del agregado sobre la fila (rastreada o nueva) y devuelve las sedes que la
    /// fila aún no tiene. No las añade a la colección: el llamador las registra como nuevas.
    /// </summary>
    public static IReadOnlyList<TenantBranchRecord> ApplyTo(TenantAggregate tenant, TenantRecord record)
    {
        record.Name = tenant.Name.GetValue();
        record.OrganizationTypeId = tenant.Type.Id;
        record.CompanyReference = tenant.CompanyReference?.GetValue();
        record.ParentTenantId = tenant.ParentTenantId?.GetValue();
        record.StatusId = tenant.Status.Id;
        record.Version = tenant.Version;
        ApplyAudit(tenant.Audit.GetValue(), record);

        var existing = record.Branches.ToDictionary(b => b.Id);
        var added = new List<TenantBranchRecord>();
        foreach (var branch in tenant.Branches)
        {
            if (existing.TryGetValue(branch.BranchId.GetValue(), out var branchRecord))
            {
                ApplyToBranch(branch, branchRecord);
            }
            else
            {
                added.Add(ToBranchRecord(branch));
            }
        }

        return added;
    }

    public static TenantBranchRecord ToBranchRecord(Branch branch)
    {
        var record = new TenantBranchRecord
        {
            Id = branch.BranchId.GetValue(),
            TenantId = branch.TenantId.GetValue(),
            Code = branch.Code.GetValue(),
        };
        ApplyToBranch(branch, record);
        return record;
    }

    public static void ApplyToBranch(Branch branch, TenantBranchRecord record)
    {
        record.Name = branch.Name.GetValue();
        record.IsActive = branch.IsActive;
        record.IsClosed = branch.IsClosed;
        record.ClosedAt = branch.ClosedAtUtc;
        record.ClosedBy = branch.ClosedBy?.GetValue();
        ApplyAudit(branch.Audit.GetValue(), record);
    }

    public static BranchLifecycleEntryRecord ToEntryRecord(BranchLifecycleEntry entry) => new()
    {
        Id = entry.Id,
        TenantId = entry.TenantId,
        BranchId = entry.BranchId,
        EpisodeId = entry.Episode.Id,
        OccurredAt = entry.OccurredAtUtc,
        ActorId = entry.ActorId,
        NameSnapshot = entry.NameSnapshot,
        Reason = entry.Reason,
    };

    /// <summary>Fila de bitácora hacia el asiento del dominio (lectura futura de la historia).</summary>
    public static BranchLifecycleEntry ToEntry(BranchLifecycleEntryRecord record) => new(
        record.Id,
        record.TenantId,
        record.BranchId,
        Unimar.Shells.Net.Ddd.DomainEnumeration.FromValue<BranchLifecycleEpisode>(record.EpisodeId)
            ?? throw new InvalidOperationException($"Episodio {record.EpisodeId} desconocido."),
        record.OccurredAt,
        record.ActorId,
        record.NameSnapshot,
        record.Reason);

    private static AuditProps ToAuditProps(AuditedRecord record) => new()
    {
        CreatedBy = record.CreatedBy,
        CreatedAt = Instants.ToUtcDateTime(record.CreatedAt),
        UpdatedBy = record.UpdatedBy,
        UpdatedAt = Instants.ToUtcDateTime(record.UpdatedAt),
        TimeSpan = record.AuditTimeSpan,
    };

    private static void ApplyAudit(AuditProps audit, AuditedRecord record)
    {
        record.CreatedBy = audit.CreatedBy;
        record.CreatedAt = Instants.ToOffset(audit.CreatedAt);
        record.UpdatedBy = audit.UpdatedBy;
        record.UpdatedAt = Instants.ToOffset(audit.UpdatedAt);
        record.AuditTimeSpan = audit.TimeSpan ?? string.Empty;
    }
}
