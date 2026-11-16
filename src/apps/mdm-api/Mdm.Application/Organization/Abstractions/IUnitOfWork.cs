namespace Mdm.Application.Organization.Abstractions;

/// <summary>
/// Confirma los cambios del repositorio en una transacción. Traduce los fallos del motor a las
/// excepciones de la aplicación: conflicto de versión a <c>ConcurrencyConflictException</c> y
/// violación de unicidad a <c>DuplicateKeyConflictException</c>.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken ct);
}
