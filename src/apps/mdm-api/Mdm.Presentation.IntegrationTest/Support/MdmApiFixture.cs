using Testcontainers.MsSql;
using Mdm.Infrastructure.Persistence;

namespace Mdm.Presentation.IntegrationTest.Support;

/// <summary>
/// Un contenedor de SQL Server 2022 por colección, con <c>InitialCreate</c> aplicada de forma explícita
/// (<see cref="MdmDatabaseMigrator"/>) y la API completa encima. Sin Docker no falla: deja
/// <see cref="IsAvailable"/> en <c>false</c> y cada prueba se salta con el motivo. Mismo patrón que
/// <c>Infrastructure.IntegrationTest</c>; no se comparte código porque eso obligaría a referenciar un proyecto
/// ejecutable de pruebas.
/// </summary>
public sealed class MdmApiFixture : IAsyncLifetime
{
    /// <summary>Imagen oficial de SQL Server 2022. MDM-001 no fija versión ni nivel de compatibilidad (G-321).</summary>
    public const string Image = "mcr.microsoft.com/mssql/server:2022-latest";

    private readonly TestJwtIssuer _issuer = new();
    private MsSqlContainer? _container;
    private SqlApiFactory? _factory;

    public bool IsAvailable { get; private set; }

    public string UnavailableReason { get; private set; } = "contenedor no iniciado";

    public SqlApiFactory Factory => _factory ?? throw new InvalidOperationException(UnavailableReason);

    public string IssueToken(string audience = TestJwtIssuer.Audience, string? keyId = TestJwtIssuer.KeyId) =>
        _issuer.IssueToken(audience, keyId);

    public async ValueTask InitializeAsync()
    {
        try
        {
            _container = new MsSqlBuilder(Image).Build();
            await _container.StartAsync();
            _factory = new SqlApiFactory(_container.GetConnectionString(), _issuer);
            await MdmDatabaseMigrator.MigrateAsync(_factory.Services);
            IsAvailable = true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            UnavailableReason = $"Docker/SQL Server no disponible: {ex.GetType().Name}: {ex.Message.Split('\n', 2)[0].Trim()}";
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_container is not null)
        {
            await _container.DisposeAsync();
        }

        _issuer.Dispose();
    }
}

[CollectionDefinition(Name)]
public sealed class MdmApiCollection : ICollectionFixture<MdmApiFixture>
{
    public const string Name = "MdmApi";
}
