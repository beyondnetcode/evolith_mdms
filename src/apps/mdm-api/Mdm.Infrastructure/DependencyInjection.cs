using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Mdm.Application.Organization.Abstractions;
using Mdm.Domain.Organization.Tenant;
using Mdm.Infrastructure.Persistence;

namespace Mdm.Infrastructure;

/// <summary>Registro de la capa de infraestructura en el contenedor de DI.</summary>
public static class DependencyInjection
{
    /// <summary>Clave de la cadena de conexión en <c>ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "Mdm";

    /// <summary>
    /// Ensamblado con las migraciones de SQL Server (ADR-0229 §3.6). Se referencia por nombre:
    /// Infrastructure no depende del proyecto de migraciones, es él quien depende de ésta.
    /// </summary>
    public const string MigrationsAssembly = "Mdm.Infrastructure.Migrations.SqlServer";

    /// <summary>
    /// Registra el <c>DbContext</c>, el repositorio con su unidad de trabajo y el almacén de lectura.
    /// Falla de inmediato si falta <c>ConnectionStrings:Mdm</c>: no hay valor por omisión que pueda
    /// apuntar a una base equivocada. NO aplica migraciones (ver <see cref="MdmDatabaseMigrator"/>).
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Falta la cadena de conexión 'ConnectionStrings:{ConnectionStringName}'.");
        }

        services.AddDbContext<MdmDbContext>(options => options.UseSqlServer(
            connectionString,
            sql =>
            {
                sql.MigrationsAssembly(MigrationsAssembly);
                // Historia de migraciones dentro del esquema mdm (MDM-001 D1).
                sql.MigrationsHistoryTable("__EFMigrationsHistory", MdmDbContext.Schema);
            }));

        // Repositorio y unidad de trabajo son la misma instancia por alcance (MarkAsPersisted).
        services.AddScoped<SqlServerTenantRepository>();
        services.AddScoped<ITenantRepository>(sp => sp.GetRequiredService<SqlServerTenantRepository>());
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<SqlServerTenantRepository>());
        services.AddScoped<ITenantReadStore, TenantReadStore>();
        return services;
    }
}
