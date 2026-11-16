using System.Collections.Frozen;
using Mdm.Application.Common;
using Mdm.Domain.Kernel;

namespace Mdm.Presentation.Http;

/// <summary>
/// Traduce el código estable de un <see cref="Result"/> fallido al estado HTTP y al <c>code</c> público
/// del contrato (§5). La correspondencia es una tabla explícita: nunca se interpreta el texto del código.
/// Excepción deliberada: todo <c>validation.*</c> es 400, porque la familia crece con cada regla de forma
/// y su estado no varía.
/// </summary>
public static class DomainErrorStatusMapper
{
    /// <summary><c>code</c> público de los fallos de validación; el detalle por campo va en <c>errors</c>.</summary>
    public const string ValidationFailed = "validation.failed";

    /// <summary>Escritura sin <c>If-Match</c> (la genera la presentación, no la aplicación).</summary>
    public const string PreconditionRequired = "precondition.required";

    private const string ValidationPrefix = "validation.";
    private const string UnknownField = "request";

    private static readonly FrozenDictionary<string, ProblemSpec> Specs = new Dictionary<string, ProblemSpec>
    {
        [DomainErrors.Tenant.NotFound] = NotFound(),
        [DomainErrors.Tenant.BranchNotFound] = NotFound(),
        [DomainErrors.Tenant.CodeNotUnique] = Conflict(
            DomainErrors.Tenant.CodeNotUnique,
            "El código de la organización ya está en uso",
            "Otra organización, aunque esté archivada, usa ese código; los códigos no se reutilizan."),
        [DomainErrors.Tenant.CompanyReferenceNotUnique] = Conflict(
            DomainErrors.Tenant.CompanyReferenceNotUnique,
            "La referencia de empresa ya está en uso",
            "Otra organización usa esa referencia de empresa."),
        [DomainErrors.Tenant.BranchCodeNotUnique] = Conflict(
            "branch.code_not_unique",
            "El código de la sede ya está en uso",
            "Otra sede de la organización, aunque esté cerrada, usa ese código; los códigos no se reutilizan."),
        [DomainErrors.Tenant.ParentInvalid] = new(
            StatusCodes.Status400BadRequest,
            "tenant.parent_not_found",
            "La organización padre no existe",
            "parentTenantId no corresponde a una organización existente."),
        [DomainErrors.Tenant.ParentArchived] = Conflict(
            DomainErrors.Tenant.ParentArchived,
            "La organización padre está archivada",
            "parentTenantId corresponde a una organización archivada, que no admite nuevos hijos."),
        [DomainErrors.Tenant.Archived] = Conflict(
            DomainErrors.Tenant.Archived,
            "La organización está archivada",
            "Una organización archivada es de solo lectura."),
        [DomainErrors.Tenant.NotActive] = Conflict(
            DomainErrors.Tenant.NotActive,
            "La organización no está activa",
            "La operación exige una organización activa."),
        [DomainErrors.Tenant.HasActiveBranches] = Conflict(
            DomainErrors.Tenant.HasActiveBranches,
            "La organización tiene sedes activas",
            "Desactiva o cierra las sedes activas antes de suspender o archivar la organización."),
        [DomainErrors.Tenant.AlreadyActive] = Conflict(
            DomainErrors.Tenant.AlreadyActive,
            "La organización ya está activa",
            "La organización no está suspendida."),
        [DomainErrors.Tenant.AlreadySuspended] = Conflict(
            DomainErrors.Tenant.AlreadySuspended,
            "La organización ya está suspendida",
            "La organización ya se encuentra suspendida."),
        [DomainErrors.Tenant.BranchClosed] = Conflict(
            "branch.closed",
            "La sede está cerrada",
            "El cierre es terminal: una sede cerrada no se modifica ni se reactiva."),
        [DomainErrors.Tenant.BranchAlreadyActive] = Conflict(
            DomainErrors.Tenant.BranchAlreadyActive,
            "La sede ya está activa",
            "La sede no está desactivada."),
        [DomainErrors.Tenant.BranchAlreadyInactive] = Conflict(
            DomainErrors.Tenant.BranchAlreadyInactive,
            "La sede ya está desactivada",
            "La sede ya se encuentra desactivada."),
        [ApplicationErrors.VersionMismatch] = new(
            StatusCodes.Status412PreconditionFailed,
            "precondition.failed",
            "La versión de la organización cambió",
            "La versión vigente no es la indicada en If-Match. Vuelve a leer la organización y reintenta."),
        [PreconditionRequired] = new(
            StatusCodes.Status428PreconditionRequired,
            PreconditionRequired,
            "Falta la precondición If-Match",
            "La escritura exige If-Match con el ETag vigente de la organización; If-Match: * no se acepta."),
        [ApplicationErrors.UserRequired] = new(
            StatusCodes.Status401Unauthorized,
            ApplicationErrors.UserRequired,
            "Se requiere un usuario autenticado",
            "El portador no identifica a un usuario (falta el claim sub)."),
        [DomainErrors.Tenant.OrganizationTypeRequired] = Validation(),
    }.ToFrozenDictionary(StringComparer.Ordinal);

    private static readonly FrozenDictionary<string, string> ValidationFields = new Dictionary<string, string>
    {
        [DomainErrors.Validation.CodeRequired] = "code",
        [DomainErrors.Validation.CodeTooLong] = "code",
        [DomainErrors.Validation.NameRequired] = "name",
        [DomainErrors.Validation.NameTooLong] = "name",
        [DomainErrors.Validation.CompanyReferenceRequired] = "companyReference",
        [DomainErrors.Validation.CompanyReferenceTooLong] = "companyReference",
        [DomainErrors.Validation.ActorRequired] = "actor",
        [DomainErrors.Validation.ActorTooLong] = "actor",
        [DomainErrors.Validation.IdRequired] = "id",
        [DomainErrors.Validation.ReasonTooLong] = "reason",
        [ApplicationErrors.Validation.PageInvalid] = "page",
        [ApplicationErrors.Validation.PageSizeInvalid] = "pageSize",
        [ApplicationErrors.Validation.SortByInvalid] = "sortBy",
        [ApplicationErrors.Validation.SortOrderInvalid] = "sortOrder",
        [ApplicationErrors.Validation.StatusInvalid] = "status",
        [ApplicationErrors.Validation.SearchTooLong] = "search",
        [ApplicationErrors.Validation.OrganizationTypeInvalid] = "organizationType",
        [ApplicationErrors.Validation.ExpectedVersionInvalid] = "If-Match",
        [DomainErrors.Tenant.OrganizationTypeRequired] = "organizationType",
    }.ToFrozenDictionary(StringComparer.Ordinal);

    /// <summary>Resuelve el código; <c>false</c> si es desconocido (el llamador responde 500 y lo registra).</summary>
    public static bool TryMap(string error, out ProblemSpec spec)
    {
        ArgumentNullException.ThrowIfNull(error);
        if (Specs.TryGetValue(error, out spec))
        {
            return true;
        }

        if (error.StartsWith(ValidationPrefix, StringComparison.Ordinal))
        {
            spec = Validation();
            return true;
        }

        spec = default;
        return false;
    }

    /// <summary>Campo al que se atribuye un código de validación (<c>errors</c> del Problem Details).</summary>
    public static string FieldOf(string validationCode)
    {
        ArgumentNullException.ThrowIfNull(validationCode);
        return ValidationFields.GetValueOrDefault(validationCode, UnknownField);
    }

    private static ProblemSpec NotFound() => new(
        StatusCodes.Status404NotFound,
        "common.not_found",
        "Recurso no encontrado",
        "La organización o la sede indicada no existe.");

    private static ProblemSpec Conflict(string code, string title, string detail) =>
        new(StatusCodes.Status409Conflict, code, title, detail);

    private static ProblemSpec Validation() => new(
        StatusCodes.Status400BadRequest,
        ValidationFailed,
        "La solicitud no es válida",
        "Corrige los campos indicados en errors y reintenta.");
}
