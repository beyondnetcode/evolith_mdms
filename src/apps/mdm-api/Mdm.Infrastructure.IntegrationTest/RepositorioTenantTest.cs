using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Mdm.Application.Common.Exceptions;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Infrastructure.IntegrationTest.Infrastructure;
using Mdm.Infrastructure.Persistence;

namespace Mdm.Infrastructure.IntegrationTest;

[Collection(MsSqlCollection.Name)]
public sealed class RepositorioTenantTest(MsSqlContainerFixture fixture) : MsSqlTestBase(fixture)
{
    [Fact]
    public async Task Alta_con_sedes_se_lee_de_vuelta_y_queda_marcada_como_persistida()
    {
        RequireSqlServer();
        var tenant = NewTenant("ALTA" + Unique);
        var lima = tenant.AddBranch(Code.Create("LIMA"), Name.Create("Sede Lima"), Actor).Value;
        tenant.DeactivateBranch(lima.BranchId, Actor, "pausa");

        await SaveNewAsync(tenant);

        tenant.PersistedVersion.Should().Be(tenant.Version);
        tenant.PendingBranchLifecycleEntries.Should().BeEmpty();
        await using var context = Fixture.CreateContext();
        var loaded = await LoadAsync(new SqlServerTenantRepository(context), tenant.TenantId.GetValue());
        loaded.Version.Should().Be(tenant.Version);
        loaded.Branches.Should().ContainSingle().Which.IsActive.Should().BeFalse();
        (await context.BranchLifecycleEntries.CountAsync(e => e.TenantId == loaded.TenantId.GetValue())).Should().Be(2);
    }

    [Fact]
    public async Task Codigo_de_tenant_duplicado_lanza_DuplicateKeyConflict_con_el_indice()
    {
        RequireSqlServer();
        var code = "DUP" + Unique;
        await SaveNewAsync(NewTenant(code));

        var act = () => SaveNewAsync(NewTenant(code));

        (await act.Should().ThrowAsync<DuplicateKeyConflictException>())
            .Which.Constraint.Should().Be(DuplicateKeyConflictException.TenantCode);
    }

    [Fact]
    public async Task El_codigo_de_un_tenant_archivado_sigue_ocupado()
    {
        RequireSqlServer();
        var code = "ARCH" + Unique;
        var first = NewTenant(code);
        first.Archive(Actor).IsSuccess.Should().BeTrue();
        await SaveNewAsync(first);

        await using var context = Fixture.CreateContext();
        var repository = new SqlServerTenantRepository(context);
        (await repository.CodeExistsAsync(Code.Create(code))).Should().BeTrue();
        var act = () => SaveNewAsync(NewTenant(code));

        (await act.Should().ThrowAsync<DuplicateKeyConflictException>())
            .Which.Constraint.Should().Be(DuplicateKeyConflictException.TenantCode);
    }

    [Fact]
    public async Task Referencia_de_empresa_duplicada_lanza_DuplicateKeyConflict()
    {
        RequireSqlServer();
        var reference = "RUC" + Unique;
        await SaveNewAsync(NewTenant("REFA" + Unique, reference));

        var act = () => SaveNewAsync(NewTenant("REFB" + Unique, reference));

        (await act.Should().ThrowAsync<DuplicateKeyConflictException>())
            .Which.Constraint.Should().Be(DuplicateKeyConflictException.TenantCompanyReference);
    }

    [Fact]
    public async Task Varios_tenants_sin_referencia_conviven_porque_el_indice_es_filtrado()
    {
        RequireSqlServer();

        await SaveNewAsync(NewTenant("SINA" + Unique));
        var act = () => SaveNewAsync(NewTenant("SINB" + Unique));

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Codigo_de_sede_duplicado_lanza_DuplicateKeyConflict()
    {
        RequireSqlServer();
        var tenant = NewTenant("SEDE" + Unique);
        await SaveNewAsync(tenant);
        await using var context = Fixture.CreateContext();
        var repository = new SqlServerTenantRepository(context);
        var loaded = await LoadAsync(repository, tenant.TenantId.GetValue());

        // Otro escritor inserta la sede entre la lectura y el guardado: el dominio no puede verla.
        await Fixture.InsertBranchRowAsync(tenant.TenantId.GetValue(), "LIMA");
        loaded.AddBranch(Code.Create("LIMA"), Name.Create("Sede Lima"), Actor).IsSuccess.Should().BeTrue();
        await repository.UpdateAsync(loaded);

        var act = () => repository.SaveChangesAsync();

        (await act.Should().ThrowAsync<DuplicateKeyConflictException>())
            .Which.Constraint.Should().Be(DuplicateKeyConflictException.TenantBranchCode);
    }

    [Fact]
    public async Task Version_desfasada_lanza_ConcurrencyConflict_y_no_pisa_el_cambio_ajeno()
    {
        RequireSqlServer();
        var tenant = NewTenant("CONC" + Unique);
        await SaveNewAsync(tenant);
        var id = tenant.TenantId.GetValue();
        await using var contextA = Fixture.CreateContext();
        await using var contextB = Fixture.CreateContext();
        var repositoryA = new SqlServerTenantRepository(contextA);
        var repositoryB = new SqlServerTenantRepository(contextB);
        var tenantA = await LoadAsync(repositoryA, id);
        var tenantB = await LoadAsync(repositoryB, id);

        tenantA.Suspend(Actor).IsSuccess.Should().BeTrue();
        await repositoryA.UpdateAsync(tenantA);
        await repositoryA.SaveChangesAsync();
        tenantB.Archive(Actor).IsSuccess.Should().BeTrue();
        await repositoryB.UpdateAsync(tenantB);
        var act = () => repositoryB.SaveChangesAsync();

        await act.Should().ThrowAsync<ConcurrencyConflictException>();
        await using var verify = Fixture.CreateContext();
        var stored = await verify.Tenants.AsNoTracking().SingleAsync(t => t.Id == id);
        stored.StatusId.Should().Be(2, "ganó la suspensión de A");
        stored.Version.Should().Be(tenantA.Version);
    }

    [Fact]
    public async Task Un_cambio_de_sede_obsoleto_tambien_choca_con_la_version_del_tenant_y_no_deja_bitacora()
    {
        RequireSqlServer();
        var tenant = NewTenant("OBSO" + Unique);
        var lima = tenant.AddBranch(Code.Create("LIMA"), Name.Create("Sede Lima"), Actor).Value;
        await SaveNewAsync(tenant);
        var id = tenant.TenantId.GetValue();
        await using var contextA = Fixture.CreateContext();
        await using var contextB = Fixture.CreateContext();
        var repositoryA = new SqlServerTenantRepository(contextA);
        var repositoryB = new SqlServerTenantRepository(contextB);
        var tenantA = await LoadAsync(repositoryA, id);
        var tenantB = await LoadAsync(repositoryB, id);

        tenantA.UpdateGeneralData(
            new Mdm.Domain.Organization.Tenant.TenantGeneralData(
                Name.Create("Nuevo nombre"), tenantA.Type, tenantA.CompanyReference), Actor);
        await repositoryA.UpdateAsync(tenantA);
        await repositoryA.SaveChangesAsync();
        tenantB.CloseBranch(lima.BranchId, Actor, "cierre").IsSuccess.Should().BeTrue();
        await repositoryB.UpdateAsync(tenantB);
        var act = () => repositoryB.SaveChangesAsync();

        await act.Should().ThrowAsync<ConcurrencyConflictException>();
        await using var verify = Fixture.CreateContext();
        (await verify.BranchLifecycleEntries.CountAsync(e => e.TenantId == id)).Should().Be(1, "solo la apertura");
        (await verify.TenantBranches.AsNoTracking().SingleAsync(b => b.TenantId == id)).IsClosed.Should().BeFalse();
    }

    [Fact]
    public async Task Reintentar_con_el_agregado_releido_tras_un_conflicto_guarda()
    {
        RequireSqlServer();
        var tenant = NewTenant("REIN" + Unique);
        await SaveNewAsync(tenant);
        var id = tenant.TenantId.GetValue();

        for (var i = 0; i < 3; i++)
        {
            await using var context = Fixture.CreateContext();
            var repository = new SqlServerTenantRepository(context);
            var loaded = await LoadAsync(repository, id);
            loaded.AddBranch(Code.Create("S" + i), Name.Create("Sede " + i), Actor).IsSuccess.Should().BeTrue();
            await repository.UpdateAsync(loaded);
            await repository.SaveChangesAsync();
        }

        await using var verify = Fixture.CreateContext();
        var final = await LoadAsync(new SqlServerTenantRepository(verify), id);
        final.Branches.Should().HaveCount(3);
        final.Version.Should().Be(4);
    }
}
