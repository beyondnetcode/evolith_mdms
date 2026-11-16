using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Mdm.Infrastructure.IntegrationTest.Infrastructure;
using Mdm.Infrastructure.Persistence;

namespace Mdm.Infrastructure.IntegrationTest;

[Collection(MsSqlCollection.Name)]
public sealed class MigracionTest(MsSqlContainerFixture fixture) : MsSqlTestBase(fixture)
{
    [Fact]
    public async Task InitialCreate_dejo_la_base_vacia_con_el_esquema_y_su_historia_en_mdm()
    {
        RequireSqlServer();
        await using var context = Fixture.CreateContext();

        var applied = await context.Database.GetAppliedMigrationsAsync();
        var history = await context.Database
            .SqlQueryRaw<string>("SELECT OBJECT_SCHEMA_NAME(OBJECT_ID(N'mdm.__EFMigrationsHistory')) AS [Value]")
            .ToListAsync();

        applied.Should().ContainSingle().Which.Should().EndWith("_InitialCreate");
        history.Should().Equal("mdm");
    }

    [Fact]
    public async Task Aplicar_de_nuevo_es_idempotente()
    {
        RequireSqlServer();
        await using var context = Fixture.CreateContext();

        var pending = await MdmDatabaseMigrator.MigrateAsync(context);

        pending.Should().Be(0);
    }

    [Fact]
    public async Task La_base_tiene_los_indices_y_restricciones_con_el_nombre_declarado()
    {
        RequireSqlServer();
        await using var context = Fixture.CreateContext();

        var indexes = await context.Database.SqlQueryRaw<string>(
            "SELECT i.name AS [Value] FROM sys.indexes i JOIN sys.objects o ON o.object_id = i.object_id "
            + "WHERE SCHEMA_NAME(o.schema_id) = N'mdm' AND i.name IS NOT NULL").ToListAsync();
        var constraints = await context.Database.SqlQueryRaw<string>(
            "SELECT name AS [Value] FROM sys.objects WHERE SCHEMA_NAME(schema_id) = N'mdm' "
            + "AND type IN ('C', 'F')").ToListAsync();

        indexes.Should().Contain(
            "UX_Tenants_Code", "UX_Tenants_CompanyReference", "UX_TenantBranches_TenantId_Code",
            "IX_Tenants_StatusId_Code", "IX_BranchLifecycleEntries_BranchId_OccurredAt");
        constraints.Should().Contain(
            "CK_Tenants_StatusId", "CK_TenantBranches_Closure", "FK_Tenants_ParentTenantId", "FK_TenantBranches_TenantId");
    }

    [Fact]
    public async Task Los_instantes_se_guardan_con_precision_de_milisegundos()
    {
        RequireSqlServer();
        await using var context = Fixture.CreateContext();

        var scales = await context.Database.SqlQueryRaw<int>(
            "SELECT CAST(scale AS int) AS [Value] FROM sys.columns "
            + "WHERE object_id = OBJECT_ID(N'mdm.Tenants') AND name IN (N'CreatedAt', N'UpdatedAt')").ToListAsync();

        scales.Should().Equal(3, 3);
    }
}
