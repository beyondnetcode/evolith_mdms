namespace Mdm.Application.Common.Exceptions;

/// <summary>
/// Una restricción de unicidad impidió guardar (carrera entre la verificación previa y el
/// INSERT). <see cref="Constraint"/> es el nombre del índice único del esquema; los handlers lo
/// mapean a su código de error.
/// </summary>
public sealed class DuplicateKeyConflictException : Exception
{
    public const string TenantCode = "UX_Tenants_Code";
    public const string TenantCompanyReference = "UX_Tenants_CompanyReference";
    public const string TenantBranchCode = "UX_TenantBranches_TenantId_Code";

    public DuplicateKeyConflictException(string constraint)
        : base($"Violación de unicidad en '{constraint}'.")
    {
        Constraint = constraint;
    }

    public DuplicateKeyConflictException(string constraint, Exception innerException)
        : base($"Violación de unicidad en '{constraint}'.", innerException)
    {
        Constraint = constraint;
    }

    /// <summary>Nombre del índice o restricción única violada.</summary>
    public string Constraint { get; }
}
