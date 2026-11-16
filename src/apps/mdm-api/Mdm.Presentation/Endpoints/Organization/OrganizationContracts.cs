using Mdm.Application.Organization.DTOs;

namespace Mdm.Presentation.Endpoints.Organization;

/// <summary>Cuerpo de E-03 (alta de organización). Un campo ausente llega vacío al caso de uso, que lo rechaza.</summary>
public sealed class CreateTenantRequest
{
    public string? Code { get; init; }

    public string? Name { get; init; }

    public string? OrganizationType { get; init; }

    public string? CompanyReference { get; init; }

    public Guid? ParentTenantId { get; init; }
}

/// <summary>Cuerpo de E-04. <c>code</c> y <c>parentTenantId</c> son inmutables y no forman parte.</summary>
public sealed class UpdateTenantRequest
{
    public string? Name { get; init; }

    public string? OrganizationType { get; init; }

    public string? CompanyReference { get; init; }
}

/// <summary>Cuerpo de E-10 (alta de sede).</summary>
public sealed class CreateBranchRequest
{
    public string? Code { get; init; }

    public string? Name { get; init; }
}

/// <summary>Cuerpo de E-11.</summary>
public sealed class UpdateBranchRequest
{
    public string? Name { get; init; }
}

/// <summary>Cuerpo opcional de las acciones (suspender, activar, archivar, desactivar, reactivar, cerrar).</summary>
public sealed class ActionRequest
{
    public string? Reason { get; init; }
}

/// <summary>Cuerpo de un alta correcta: el identificador y la versión que ya viaja como <c>ETag</c>.</summary>
public sealed record CreatedResponse(Guid Id, long Version);

/// <summary>Organización publicada (contrato §2.1).</summary>
public sealed record TenantResponse(
    Guid Id,
    string Code,
    string Name,
    string OrganizationType,
    string? CompanyReference,
    Guid? ParentTenantId,
    string Status,
    long Version,
    DateTimeOffset CreatedAt,
    string CreatedBy,
    DateTimeOffset? UpdatedAt,
    string? UpdatedBy)
{
    public static TenantResponse From(TenantDto dto)
    {
        ArgumentNullException.ThrowIfNull(dto);
        return new TenantResponse(
            dto.Id, dto.Code, dto.Name, dto.Type, dto.CompanyReference, dto.ParentTenantId,
            dto.Status, dto.Version, dto.CreatedAt, dto.CreatedBy, dto.UpdatedAt, dto.UpdatedBy);
    }
}

/// <summary>Sede publicada (contrato §2.2). Su versión no se publica: es el <c>ETag</c> de la organización.</summary>
public sealed record BranchResponse(
    Guid Id,
    Guid TenantId,
    string Code,
    string Name,
    bool IsActive,
    bool IsClosed,
    DateTimeOffset? ClosedAt,
    string? ClosedBy)
{
    public static BranchResponse From(BranchDto dto)
    {
        ArgumentNullException.ThrowIfNull(dto);
        return new BranchResponse(dto.Id, dto.TenantId, dto.Code, dto.Name, dto.IsActive, dto.IsClosed, dto.ClosedAt, dto.ClosedBy);
    }
}

/// <summary>Página del listado de organizaciones (contrato §1.2).</summary>
public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount, int TotalPages);
