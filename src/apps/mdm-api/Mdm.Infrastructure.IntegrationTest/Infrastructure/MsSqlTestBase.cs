using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using Mdm.Infrastructure.Persistence;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

namespace Mdm.Infrastructure.IntegrationTest.Infrastructure;

/// <summary>Base de las pruebas contra SQL Server real: salto sin Docker y utilidades de siembra.</summary>
public abstract class MsSqlTestBase(MsSqlContainerFixture fixture)
{
    protected static readonly ActorId Actor = ActorId.Create("prueba");

    protected MsSqlContainerFixture Fixture { get; } = fixture;

    /// <summary>Prefijo único por prueba: la base se comparte dentro de la colección.</summary>
    protected string Unique { get; } = Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();

    /// <summary>Salta la prueba, con el motivo, si no hay contenedor.</summary>
    protected void RequireSqlServer() =>
        Assert.SkipUnless(Fixture.IsAvailable, Fixture.UnavailableReason);

    protected static TenantAggregate NewTenant(string code, string? companyReference = null)
    {
        var data = new NewTenant(
            Code.Create(code),
            Name.Create("Organización " + code),
            OrganizationType.CLIENT,
            companyReference is null ? null : CompanyReference.Create(companyReference));
        return TenantAggregate.Create(data, Actor).Value;
    }

    /// <summary>Guarda el tenant en un contexto propio, como lo haría una solicitud.</summary>
    protected async Task SaveNewAsync(TenantAggregate tenant)
    {
        await using var context = Fixture.CreateContext();
        var repository = new SqlServerTenantRepository(context);
        await repository.AddAsync(tenant);
        await repository.SaveChangesAsync();
    }

    /// <summary>Carga el tenant en un contexto que el llamador debe liberar: rastreo independiente.</summary>
    protected static async Task<TenantAggregate> LoadAsync(SqlServerTenantRepository repository, Guid id) =>
        (await repository.GetByIdAsync(TenantId.Load(id)))!;
}
