using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Mdm.Domain.Organization.Tenant;
using Mdm.Infrastructure.Persistence.Records;
using DomainCode = Mdm.Domain.Kernel.ValueObjects.Code;
using DomainCompanyReference = Mdm.Domain.Kernel.ValueObjects.CompanyReference;
using DomainName = Mdm.Domain.Kernel.ValueObjects.Name;

namespace Mdm.Infrastructure.Persistence.Configurations;

/// <summary>Esquema físico de <c>mdm.Tenants</c> (MDM-001 D1, D4 y D5).</summary>
internal sealed class TenantConfiguration : IEntityTypeConfiguration<TenantRecord>
{
    public const string TableName = "Tenants";
    public const string UniqueCodeIndex = "UX_Tenants_Code";
    public const string UniqueCompanyReferenceIndex = "UX_Tenants_CompanyReference";

    public void Configure(EntityTypeBuilder<TenantRecord> builder)
    {
        builder.ToTable(TableName, MdmDbContext.Schema, table =>
        {
            table.HasCheckConstraint(
                "CK_Tenants_OrganizationTypeId",
                $"[OrganizationTypeId] IN ({IdsOf<OrganizationType>()})");
            table.HasCheckConstraint("CK_Tenants_StatusId", $"[StatusId] IN ({IdsOf<TenantStatus>()})");
            table.HasCheckConstraint("CK_Tenants_Version", "[Version] >= 1");
            table.HasCheckConstraint("CK_Tenants_ParentNotSelf", "[ParentTenantId] IS NULL OR [ParentTenantId] <> [Id]");
        });

        // MDM-001 D3: el Id lo asigna la aplicación (o se importa de UMS), nunca el motor.
        builder.HasKey(x => x.Id).HasName("PK_Tenants");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(DomainCode.MaxLength).UseCollation(MdmDbContext.Collation).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(DomainName.MaxLength).UseCollation(MdmDbContext.Collation).IsRequired();
        builder.Property(x => x.OrganizationTypeId).IsRequired();
        builder.Property(x => x.CompanyReference).HasMaxLength(DomainCompanyReference.MaxLength).UseCollation(MdmDbContext.Collation);
        builder.Property(x => x.StatusId).IsRequired();

        // MDM-001 D4: la versión entera del agregado es el único token; la incrementa la aplicación.
        builder.Property(x => x.Version).IsRequired().ValueGeneratedNever().IsConcurrencyToken();

        builder.ConfigureAudit();

        // MDM-001 D5: sin filtro por estado, el código de una organización archivada sigue ocupado.
        builder.HasIndex(x => x.Code).IsUnique().HasDatabaseName(UniqueCodeIndex);

        // Una referencia de empresa identifica a una sola organización; muchas no tienen ninguna.
        builder.HasIndex(x => x.CompanyReference)
            .IsUnique()
            .HasFilter("[CompanyReference] IS NOT NULL")
            .HasDatabaseName(UniqueCompanyReferenceIndex);

        // Ruta del listado: filtro por estado ordenado por código.
        builder.HasIndex(x => new { x.StatusId, x.Code }).HasDatabaseName("IX_Tenants_StatusId_Code");

        // Soporte de la FK a la matriz y de «las filiales de este tenant».
        builder.HasIndex(x => x.ParentTenantId).HasDatabaseName("IX_Tenants_ParentTenantId");

        // Borrado lógico (archivar): nunca hay cascada de borrado físico.
        builder.HasOne<TenantRecord>()
            .WithMany()
            .HasForeignKey(x => x.ParentTenantId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Tenants_ParentTenantId");
    }

    private static string IdsOf<T>()
        where T : Unimar.Shells.Net.Ddd.DomainEnumeration =>
        string.Join(", ", Unimar.Shells.Net.Ddd.DomainEnumeration.GetAll<T>().Select(e => e.Id).Order());
}
