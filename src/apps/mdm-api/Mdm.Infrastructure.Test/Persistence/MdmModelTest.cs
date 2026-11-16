using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Mdm.Infrastructure.Persistence;
using Mdm.Infrastructure.Persistence.Records;

namespace Mdm.Infrastructure.Test.Persistence;

/// <summary>
/// Contrato del esquema físico de MDM-001, comprobado sobre el modelo de EF Core. No abre conexión:
/// la cadena solo selecciona el proveedor. El esquema real lo prueba la suite de integración.
/// </summary>
public sealed class MdmModelTest : IDisposable
{
    private readonly MdmDbContext _context = new(
        new DbContextOptionsBuilder<MdmDbContext>().UseSqlServer("Server=nunca-se-conecta;Database=Mdm").Options);

    private IModel Model => _context.GetService<IDesignTimeModel>().Model;

    public void Dispose() => _context.Dispose();

    private IEntityType Entity<T>() => Model.FindEntityType(typeof(T))!;

    private static IIndex Index(IEntityType entity, string name) =>
        entity.GetIndexes().Single(i => i.GetDatabaseName() == name);

    [Theory]
    [InlineData(typeof(TenantRecord), "Tenants")]
    [InlineData(typeof(TenantBranchRecord), "TenantBranches")]
    [InlineData(typeof(BranchLifecycleEntryRecord), "BranchLifecycleEntries")]
    public void Las_tablas_viven_en_el_esquema_mdm_con_nombre_en_ingles_y_plural(Type record, string table)
    {
        var entity = Model.FindEntityType(record)!;

        entity.GetSchema().Should().Be("mdm");
        entity.GetTableName().Should().Be(table);
    }

    [Fact]
    public void Version_es_bigint_y_el_unico_token_de_concurrencia()
    {
        var tenant = Entity<TenantRecord>();

        tenant.GetProperties().Where(p => p.IsConcurrencyToken).Select(p => p.Name).Should().Equal("Version");
        tenant.FindProperty("Version")!.GetColumnType().Should().Be("bigint");
        Entity<TenantBranchRecord>().GetProperties().Should().NotContain(p => p.IsConcurrencyToken);
    }

    [Fact]
    public void Los_identificadores_los_asigna_la_aplicacion()
    {
        foreach (var entity in new[] { Entity<TenantRecord>(), Entity<TenantBranchRecord>(), Entity<BranchLifecycleEntryRecord>() })
        {
            var id = entity.FindProperty("Id")!;
            id.GetColumnType().Should().Be("uniqueidentifier");
            id.ValueGenerated.Should().Be(ValueGenerated.Never);
        }
    }

    [Fact]
    public void Todo_instante_es_datetimeoffset_3()
    {
        var instants = new[]
        {
            (Entity<TenantRecord>(), "CreatedAt"), (Entity<TenantRecord>(), "UpdatedAt"),
            (Entity<TenantBranchRecord>(), "CreatedAt"), (Entity<TenantBranchRecord>(), "UpdatedAt"),
            (Entity<TenantBranchRecord>(), "ClosedAt"), (Entity<BranchLifecycleEntryRecord>(), "OccurredAt"),
        };

        foreach (var (entity, name) in instants)
        {
            entity.FindProperty(name)!.GetColumnType().Should().Be("datetimeoffset(3)", $"{entity.GetTableName()}.{name}");
        }
    }

    [Fact]
    public void Los_codigos_son_unicos_sin_filtrar_por_estado()
    {
        var tenantCode = Index(Entity<TenantRecord>(), "UX_Tenants_Code");
        tenantCode.IsUnique.Should().BeTrue();
        tenantCode.GetFilter().Should().BeNull();
        tenantCode.Properties.Select(p => p.Name).Should().Equal("Code");

        var branchCode = Index(Entity<TenantBranchRecord>(), "UX_TenantBranches_TenantId_Code");
        branchCode.IsUnique.Should().BeTrue();
        branchCode.GetFilter().Should().BeNull();
        branchCode.Properties.Select(p => p.Name).Should().Equal("TenantId", "Code");
    }

    [Fact]
    public void La_referencia_de_empresa_es_unica_solo_cuando_existe()
    {
        var index = Index(Entity<TenantRecord>(), "UX_Tenants_CompanyReference");

        index.IsUnique.Should().BeTrue();
        index.GetFilter().Should().Be("[CompanyReference] IS NOT NULL");
    }

    [Fact]
    public void Ninguna_clave_foranea_borra_en_cascada()
    {
        var foreignKeys = Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()).ToList();

        foreignKeys.Should().HaveCount(4);
        foreignKeys.Should().OnlyContain(fk => fk.DeleteBehavior == DeleteBehavior.NoAction);
        foreignKeys.Select(fk => fk.GetConstraintName()).Should().BeEquivalentTo(
            "FK_Tenants_ParentTenantId", "FK_TenantBranches_TenantId",
            "FK_BranchLifecycleEntries_BranchId", "FK_BranchLifecycleEntries_TenantId");
    }

    [Fact]
    public void Todo_indice_y_restriccion_lleva_nombre_explicito_con_prefijo_convenido()
    {
        var indexNames = Model.GetEntityTypes().SelectMany(e => e.GetIndexes()).Select(i => i.GetDatabaseName()!).ToList();
        var keyNames = Model.GetEntityTypes().SelectMany(e => e.GetKeys()).Select(k => k.GetName()!).ToList();
        var checkNames = Model.GetEntityTypes().SelectMany(e => e.GetCheckConstraints()).Select(c => c.Name!).ToList();

        indexNames.Should().OnlyContain(n => n.StartsWith("UX_", StringComparison.Ordinal) || n.StartsWith("IX_", StringComparison.Ordinal));
        keyNames.Should().OnlyContain(n => n.StartsWith("PK_", StringComparison.Ordinal));
        checkNames.Should().NotBeEmpty().And.OnlyContain(n => n.StartsWith("CK_", StringComparison.Ordinal));
    }

    [Fact]
    public void Las_columnas_de_texto_con_unicidad_fijan_la_intercalacion()
    {
        Entity<TenantRecord>().FindProperty("Code")!.GetCollation().Should().Be(MdmDbContext.Collation);
        Entity<TenantRecord>().FindProperty("CompanyReference")!.GetCollation().Should().Be(MdmDbContext.Collation);
        Entity<TenantBranchRecord>().FindProperty("Code")!.GetCollation().Should().Be(MdmDbContext.Collation);
    }

    [Fact]
    public void La_bitacora_tiene_indice_por_sede_y_momento()
    {
        var index = Index(Entity<BranchLifecycleEntryRecord>(), "IX_BranchLifecycleEntries_BranchId_OccurredAt");

        index.IsUnique.Should().BeFalse();
        index.Properties.Select(p => p.Name).Should().Equal("BranchId", "OccurredAt");
    }
}
