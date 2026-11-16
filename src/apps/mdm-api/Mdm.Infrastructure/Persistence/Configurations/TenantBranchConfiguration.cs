using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Mdm.Infrastructure.Persistence.Records;
using DomainCode = Mdm.Domain.Kernel.ValueObjects.Code;
using DomainName = Mdm.Domain.Kernel.ValueObjects.Name;

namespace Mdm.Infrastructure.Persistence.Configurations;

/// <summary>Esquema físico de <c>mdm.TenantBranches</c> (MDM-001 D1 y D5).</summary>
internal sealed class TenantBranchConfiguration : IEntityTypeConfiguration<TenantBranchRecord>
{
    public const string TableName = "TenantBranches";
    public const string UniqueCodeIndex = "UX_TenantBranches_TenantId_Code";

    public void Configure(EntityTypeBuilder<TenantBranchRecord> builder)
    {
        builder.ToTable(TableName, MdmDbContext.Schema, table =>
        {
            // El cierre es terminal y apaga IsActive; una sede abierta no tiene marca de cierre.
            table.HasCheckConstraint(
                "CK_TenantBranches_Closure",
                "([IsClosed] = 0 AND [ClosedAt] IS NULL AND [ClosedBy] IS NULL)"
                + " OR ([IsClosed] = 1 AND [ClosedAt] IS NOT NULL AND [IsActive] = 0)");
        });

        builder.HasKey(x => x.Id).HasName("PK_TenantBranches");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.TenantId).IsRequired();
        builder.Property(x => x.Code).HasMaxLength(DomainCode.MaxLength).UseCollation(MdmDbContext.Collation).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(DomainName.MaxLength).UseCollation(MdmDbContext.Collation).IsRequired();
        builder.Property(x => x.IsActive).IsRequired();
        builder.Property(x => x.IsClosed).IsRequired();
        builder.Property(x => x.ClosedAt).HasColumnType(AuditColumns.InstantType);
        builder.Property(x => x.ClosedBy).HasMaxLength(AuditColumns.ActorLength);

        builder.ConfigureAudit();

        // MDM-001 D5: sin filtro por estado, el código de una sede cerrada sigue ocupado. Al llevar
        // TenantId como primera columna, también sirve de índice de «las sedes de este tenant».
        builder.HasIndex(x => new { x.TenantId, x.Code }).IsUnique().HasDatabaseName(UniqueCodeIndex);

        builder.HasOne(x => x.Tenant)
            .WithMany(x => x.Branches)
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_TenantBranches_TenantId");
    }
}
