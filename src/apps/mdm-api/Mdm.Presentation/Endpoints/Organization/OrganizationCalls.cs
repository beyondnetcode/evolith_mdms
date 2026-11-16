using MediatR;

namespace Mdm.Presentation.Endpoints.Organization;

/// <summary>Parámetros comunes de un endpoint de organización, agrupados para <c>[AsParameters]</c>.</summary>
public readonly record struct TenantCall(Guid Id, HttpContext Http, ISender Sender)
{
    public CancellationToken Ct => Http.RequestAborted;
}

/// <summary>Parámetros comunes de un endpoint de sede.</summary>
public readonly record struct BranchCall(Guid Id, Guid BranchId, HttpContext Http, ISender Sender)
{
    public CancellationToken Ct => Http.RequestAborted;
}

/// <summary>Parámetros de un endpoint sin identificadores de ruta (listado, alta).</summary>
public readonly record struct RootCall(HttpContext Http, ISender Sender)
{
    public CancellationToken Ct => Http.RequestAborted;
}
