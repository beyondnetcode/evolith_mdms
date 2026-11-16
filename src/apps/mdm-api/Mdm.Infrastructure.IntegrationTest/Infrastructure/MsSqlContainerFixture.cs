using Microsoft.EntityFrameworkCore;
using Testcontainers.MsSql;
using Mdm.Infrastructure;
using Mdm.Infrastructure.Persistence;

namespace Mdm.Infrastructure.IntegrationTest.Infrastructure;

/// <summary>
/// Levanta UN contenedor de SQL Server 2022 por colección y le aplica las migraciones como lo hace
/// quien despliega (<see cref="MdmDatabaseMigrator"/>). Sin Docker no falla: deja
/// <see cref="IsAvailable"/> en <c>false</c> y cada prueba se salta con el motivo, de modo que un
/// equipo sin Docker no queda en rojo por algo que no es del código.
/// </summary>
public sealed class MsSqlContainerFixture : IAsyncLifetime
{
    /// <summary>Imagen oficial de SQL Server 2022. MDM-001 no fija versión ni nivel de compatibilidad (G-321).</summary>
    public const string Image = "mcr.microsoft.com/mssql/server:2022-latest";

    private MsSqlContainer? _container;

    public string ConnectionString { get; private set; } = string.Empty;

    public bool IsAvailable { get; private set; }

    /// <summary>Por qué no hay contenedor, si no lo hay.</summary>
    public string UnavailableReason { get; private set; } = "contenedor no iniciado";

    public async ValueTask InitializeAsync()
    {
        try
        {
            _container = new MsSqlBuilder(Image).Build();
            await _container.StartAsync();
            ConnectionString = _container.GetConnectionString();
            await using var context = CreateContext();
            await MdmDatabaseMigrator.MigrateAsync(context);
            IsAvailable = true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Se registra el motivo y se sigue: las pruebas se saltan, no fallan.
            UnavailableReason = $"Docker/SQL Server no disponible: {ex.GetType().Name}: {FirstLine(ex.Message)}";
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    /// <summary>Un contexto nuevo (cada uno con su propio rastreo, como dos solicitudes distintas).</summary>
    public MdmDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<MdmDbContext>()
            .UseSqlServer(ConnectionString, sql =>
            {
                sql.MigrationsAssembly(DependencyInjection.MigrationsAssembly);
                sql.MigrationsHistoryTable("__EFMigrationsHistory", MdmDbContext.Schema);
            })
            .Options);

    /// <summary>
    /// Inserta una sede por SQL directo, como lo haría otro escritor, para provocar el choque con
    /// el índice único que el dominio no puede ver desde su copia cargada del agregado.
    /// </summary>
    public async Task InsertBranchRowAsync(Guid tenantId, string code)
    {
        await using var context = CreateContext();
        var now = DateTimeOffset.UtcNow;
        await context.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO mdm.TenantBranches
                (Id, TenantId, Code, Name, IsActive, IsClosed, CreatedBy, CreatedAt, AuditTimeSpan)
            VALUES ({Guid.NewGuid()}, {tenantId}, {code}, {"Sede " + code}, 1, 0, {"otro-escritor"}, {now}, {"0"})
            """);
    }

    private static string FirstLine(string message) => message.Split('\n', 2)[0].Trim();
}

[CollectionDefinition(Name)]
public sealed class MsSqlCollection : ICollectionFixture<MsSqlContainerFixture>
{
    public const string Name = "MsSql";
}
