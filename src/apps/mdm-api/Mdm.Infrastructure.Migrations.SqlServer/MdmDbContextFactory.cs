using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Mdm.Infrastructure;
using Mdm.Infrastructure.Persistence;

namespace Mdm.Infrastructure.Migrations.SqlServer;

/// <summary>
/// Fábrica de tiempo de DISEÑO para <c>dotnet ef</c>: no interviene en runtime. Generar una
/// migración no abre conexión, así que basta el valor por omisión; para <c>database update</c> o
/// <c>script</c> contra una base real se da la cadena en la variable <c>MDM_MIGRATIONS_CONNECTION</c>
/// (nunca en el repositorio, S-43).
/// </summary>
public sealed class MdmDbContextFactory : IDesignTimeDbContextFactory<MdmDbContext>
{
    private const string ConnectionVariable = "MDM_MIGRATIONS_CONNECTION";

    // Marcador local sin credenciales: solo para que EF resuelva el proveedor al generar migraciones.
    private const string DesignTimeDefault = "Server=localhost;Database=Mdm;Integrated Security=true;TrustServerCertificate=true";

    public MdmDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable(ConnectionVariable);
        var options = new DbContextOptionsBuilder<MdmDbContext>()
            .UseSqlServer(
                string.IsNullOrWhiteSpace(connection) ? DesignTimeDefault : connection,
                sql =>
                {
                    sql.MigrationsAssembly(DependencyInjection.MigrationsAssembly);
                    sql.MigrationsHistoryTable("__EFMigrationsHistory", MdmDbContext.Schema);
                })
            .Options;
        return new MdmDbContext(options);
    }
}
