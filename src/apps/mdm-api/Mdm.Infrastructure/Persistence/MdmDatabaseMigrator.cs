using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Mdm.Infrastructure.Persistence;

/// <summary>
/// Aplicación EXPLÍCITA de las migraciones (ADR-0229 §3.6): nada en el arranque de la API las
/// aplica. Quien despliega (un job, un comando de operación o una prueba) llama a este método.
/// </summary>
public static class MdmDatabaseMigrator
{
    /// <summary>Aplica las migraciones pendientes del esquema <c>mdm</c> y devuelve cuántas aplicó.</summary>
    public static async Task<int> MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(services);
        await using var scope = services.CreateAsyncScope();
        return await MigrateAsync(scope.ServiceProvider.GetRequiredService<MdmDbContext>(), cancellationToken)
            .ConfigureAwait(false);
    }

    public static async Task<int> MigrateAsync(MdmDbContext dbContext, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        var pending = (await dbContext.Database.GetPendingMigrationsAsync(cancellationToken).ConfigureAwait(false)).Count();
        await dbContext.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        return pending;
    }
}
