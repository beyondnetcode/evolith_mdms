namespace Mdm.Application.Organization;

using Mdm.Application.Common;
using Mdm.Application.Common.Exceptions;
using Mdm.Application.Organization.Abstractions;
using Mdm.Domain.Kernel;

/// <summary>
/// Convierte los conflictos de persistencia (excepciones de la unidad de trabajo) en códigos de
/// error: la regla es del dominio, pero la carrera solo la detecta el motor al guardar.
/// </summary>
internal static class PersistenceErrors
{
    /// <summary>
    /// Guarda y traduce <see cref="ConcurrencyConflictException"/> y <see cref="DuplicateKeyConflictException"/>.
    /// Una restricción desconocida no se oculta: la excepción se propaga.
    /// </summary>
    public static async Task<Result> TrySaveAsync(this IUnitOfWork unitOfWork, CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
            return Result.Success();
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure(ApplicationErrors.VersionMismatch);
        }
        catch (DuplicateKeyConflictException ex) when (CodeOf(ex.Constraint) is not null)
        {
            return Result.Failure(CodeOf(ex.Constraint)!);
        }
    }

    private static string? CodeOf(string constraint) => constraint switch
    {
        DuplicateKeyConflictException.TenantCode => DomainErrors.Tenant.CodeNotUnique,
        DuplicateKeyConflictException.TenantCompanyReference => DomainErrors.Tenant.CompanyReferenceNotUnique,
        DuplicateKeyConflictException.TenantBranchCode => DomainErrors.Tenant.BranchCodeNotUnique,
        _ => null,
    };
}
