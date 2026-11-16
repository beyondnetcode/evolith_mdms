namespace Mdm.Application.Common;

/// <summary>
/// Códigos de error propios de la capa de aplicación (los de dominio viven en
/// <c>DomainErrors</c>). Son contrato igual que aquellos: se añaden, no se renombran.
/// </summary>
public static class ApplicationErrors
{
    /// <summary>El token de concurrencia (If-Match) no coincide con la versión actual.</summary>
    public const string VersionMismatch = "concurrency.version_mismatch";

    /// <summary>La operación exige un usuario autenticado.</summary>
    public const string UserRequired = "auth.user_required";

    /// <summary>Errores de forma de los datos de entrada de una consulta o comando.</summary>
    public static class Validation
    {
        public const string PageInvalid = "validation.page_invalid";
        public const string PageSizeInvalid = "validation.page_size_invalid";
        public const string SortByInvalid = "validation.sort_by_invalid";
        public const string SortOrderInvalid = "validation.sort_order_invalid";
        public const string StatusInvalid = "validation.status_invalid";
        public const string SearchTooLong = "validation.search_too_long";
        public const string OrganizationTypeInvalid = "validation.organization_type_invalid";
        public const string ExpectedVersionInvalid = "validation.expected_version_invalid";
    }
}
