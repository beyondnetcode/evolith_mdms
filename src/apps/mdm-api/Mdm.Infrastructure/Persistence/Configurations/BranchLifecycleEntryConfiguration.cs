using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Mdm.Domain.Organization.Tenant.Branch;
using Mdm.Infrastructure.Persistence.Records;
using DomainName = Mdm.Domain.Kernel.ValueObjects.Name;

namespace Mdm.Infrastructure.Persistence.Configurations;

/// <summary>
/// Esquema físico de <c>mdm.BranchLifecycleEntries</c>. Append-only por diseño de la aplicación
/// (MDM-001 D6): el motor no lo impone todavía (G-325).
/// </summary>
internal sealed class BranchLifecycleEntryConfiguration : IEntityTypeConfiguration<BranchLifecycleEntryRecord>
{
    public const string TableName = "BranchLifecycleEntries";

    public void Configure(EntityTypeBuilder<BranchLifecycleEntryRecord> builder)
    {
        builder.ToTable(TableName, MdmDbContext.Schema, table =>
        {
            var episodes = string.Join(
                ", ",
                Unimar.Shells.Net.Ddd.DomainEnumeration.GetAll<BranchLifecycleEpisode>().Select(e => e.Id).Order());
            table.HasCheckConstraint("CK_BranchLifecycleEntries_EpisodeId", $"[EpisodeId] IN ({episodes})");
        });

        builder.HasKey(x => x.Id).HasName("PK_BranchLifecycleEntries");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.BranchId).IsRequired();
        builder.Property(x => x.EpisodeId).IsRequired();
        builder.Property(x => x.OccurredAt).HasColumnType(AuditColumns.InstantType).IsRequired();
        builder.Property(x => x.ActorId).HasMaxLength(AuditColumns.ActorLength).IsRequired();
        builder.Property(x => x.NameSnapshot).HasMaxLength(DomainName.MaxLength).IsRequired();
        builder.Property(x => x.Reason).HasMaxLength(BranchLifecycleEntry.ReasonMaxLength);

        // Lectura de la historia de una sede en orden cronológico.
        builder.HasIndex(x => new { x.BranchId, x.OccurredAt }).HasDatabaseName("IX_BranchLifecycleEntries_BranchId_OccurredAt");

        // Soporte de la FK al tenant.
        builder.HasIndex(x => x.TenantId).HasDatabaseName("IX_BranchLifecycleEntries_TenantId");

        builder.HasOne<TenantBranchRecord>()
            .WithMany()
            .HasForeignKey(x => x.BranchId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_BranchLifecycleEntries_BranchId");

        builder.HasOne<TenantRecord>()
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_BranchLifecycleEntries_TenantId");
    }
}
