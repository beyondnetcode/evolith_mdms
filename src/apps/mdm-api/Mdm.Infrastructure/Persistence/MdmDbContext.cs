using Microsoft.EntityFrameworkCore;
using Mdm.Infrastructure.Persistence.Configurations;
using Mdm.Infrastructure.Persistence.Records;

namespace Mdm.Infrastructure.Persistence;

/// <summary>
/// Contexto de EF Core de <c>mdm-api</c>: esquema <c>mdm</c> (MDM-001 D1). Es una frontera de
/// persistencia: el dominio nunca ve estos tipos.
/// </summary>
public sealed class MdmDbContext(DbContextOptions<MdmDbContext> options) : DbContext(options)
{
    /// <summary>Esquema de todas las tablas, incluida la historia de migraciones.</summary>
    public const string Schema = "mdm";

    /// <summary>
    /// Intercalación fijada por columna (<c>Code</c>, <c>Name</c>, <c>CompanyReference</c>) y no
    /// heredada de la instancia: el default de una instancia Linux y el de una Windows no
    /// coinciden, y la unicidad depende de ella. Va en la columna y no en el modelo porque EF Core
    /// no emite <c>COLLATE</c> en las columnas que igualan la intercalación del modelo.
    /// </summary>
    public const string Collation = "Latin1_General_100_CI_AS";

    public DbSet<TenantRecord> Tenants => Set<TenantRecord>();

    public DbSet<TenantBranchRecord> TenantBranches => Set<TenantBranchRecord>();

    public DbSet<BranchLifecycleEntryRecord> BranchLifecycleEntries => Set<BranchLifecycleEntryRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new TenantConfiguration());
        modelBuilder.ApplyConfiguration(new TenantBranchConfiguration());
        modelBuilder.ApplyConfiguration(new BranchLifecycleEntryConfiguration());
    }
}
