namespace Mdm.Domain.Kernel;

/// <summary>
/// Catálogo de códigos de error de dominio. Son contrato: la presentación los publica en el campo
/// <c>code</c> del Problem Details y los clientes ramifican por ellos. Se añaden; no se renombran.
/// </summary>
public static class DomainErrors
{
    /// <summary>Reglas de forma de los objetos de valor.</summary>
    public static class Validation
    {
        public const string CodeRequired = "validation.code_required";
        public const string CodeTooLong = "validation.code_too_long";
        public const string NameRequired = "validation.name_required";
        public const string NameTooLong = "validation.name_too_long";
        public const string CompanyReferenceRequired = "validation.company_reference_required";
        public const string CompanyReferenceTooLong = "validation.company_reference_too_long";
        public const string ActorRequired = "validation.actor_required";
        public const string ActorTooLong = "validation.actor_too_long";
        public const string IdRequired = "validation.id_required";
        public const string ReasonTooLong = "validation.reason_too_long";
    }

    /// <summary>Reglas del agregado organización (Tenant) y de sus sedes (Branch).</summary>
    public static class Tenant
    {
        public const string NotFound = "tenant.not_found";
        public const string CodeNotUnique = "tenant.code_not_unique";
        public const string CompanyReferenceNotUnique = "tenant.company_reference_not_unique";
        public const string OrganizationTypeRequired = "tenant.organization_type_required";

        /// <summary>El padre indicado no existe, o el tenant sería su propio padre.</summary>
        public const string ParentInvalid = "tenant.parent_invalid";

        /// <summary>El padre indicado está archivado: no admite nuevos hijos.</summary>
        public const string ParentArchived = "tenant.parent_archived";

        /// <summary>Suspender un tenant que ya está suspendido.</summary>
        public const string AlreadySuspended = "tenant.already_suspended";

        /// <summary>Reactivar un tenant que ya está activo.</summary>
        public const string AlreadyActive = "tenant.already_active";

        /// <summary>El tenant archivado es de solo lectura: archivar es terminal.</summary>
        public const string Archived = "tenant.archived";

        /// <summary>La operación aumenta la actividad del tenant y exige que esté activo.</summary>
        public const string NotActive = "tenant.not_active";

        /// <summary>No se suspende ni se archiva un tenant con sedes activas no cerradas.</summary>
        public const string HasActiveBranches = "tenant.has_active_branches";

        public const string BranchCodeNotUnique = "tenant.branch_code_not_unique";
        public const string BranchNotFound = "tenant.branch_not_found";

        /// <summary>La sede está cerrada: el cierre es terminal y no admite ninguna otra operación.</summary>
        public const string BranchClosed = "tenant.branch_closed";

        /// <summary>Desactivar una sede que ya está inactiva.</summary>
        public const string BranchAlreadyInactive = "branch.already_inactive";

        /// <summary>Reactivar una sede que ya está activa.</summary>
        public const string BranchAlreadyActive = "branch.already_active";
    }
}
