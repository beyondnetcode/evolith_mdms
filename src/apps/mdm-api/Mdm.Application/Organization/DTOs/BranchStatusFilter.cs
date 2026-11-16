namespace Mdm.Application.Organization.DTOs;

/// <summary>Filtro por estado del listado de sedes.</summary>
public enum BranchStatusFilter
{
    /// <summary>Activas y no cerradas.</summary>
    Active,

    /// <summary>Inactivas (pausadas) y no cerradas.</summary>
    Inactive,

    /// <summary>Cerradas definitivamente.</summary>
    Closed,

    /// <summary>Todas.</summary>
    All,
}
