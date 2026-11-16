using MediatR;
using Microsoft.AspNetCore.Mvc;
using Mdm.Application.Common;
using Mdm.Application.Organization.Tenants.Commands;
using Mdm.Application.Organization.Tenants.Queries;
using Mdm.Domain.Kernel;
using Mdm.Domain.Organization.Tenant;
using Mdm.Presentation.Http;

namespace Mdm.Presentation.Endpoints.Organization;

/// <summary>E-01 a E-07 del contrato: organización (<c>Tenant</c>).</summary>
internal static class TenantEndpoints
{
    private const string TenantPath = "/api/v1/tenants";

    private enum TenantAction
    {
        Suspend,
        Activate,
        Archive,
    }

    public static RouteGroupBuilder MapTenantEndpoints(this RouteGroupBuilder api)
    {
        var tenants = api.MapGroup("/tenants").WithTags("Tenants");
        tenants.MapGet("/", ListAsync);
        tenants.MapGet("/{id:guid}", GetAsync);
        tenants.MapPost("/", CreateAsync);
        tenants.MapPut("/{id:guid}", UpdateAsync);
        tenants.MapPost("/{id:guid}/suspend", ([AsParameters] TenantCall c) => ActAsync(c, TenantAction.Suspend));
        tenants.MapPost("/{id:guid}/activate", ([AsParameters] TenantCall c) => ActAsync(c, TenantAction.Activate));
        tenants.MapDelete("/{id:guid}", ([AsParameters] TenantCall c) => ActAsync(c, TenantAction.Archive));
        return api;
    }

    // E-01
    private static async Task<IResult> ListAsync([AsParameters] RootCall c)
    {
        var query = ListTenantsParameters.Read(c.Http.Request.Query);
        if (query.IsFailure)
        {
            return query.ToProblem(c.Http);
        }

        var page = await c.Sender.Send(query.Value, c.Ct).ConfigureAwait(false);
        if (page.IsFailure)
        {
            return page.ToProblem(c.Http);
        }

        var p = page.Value;
        var totalPages = (int)Math.Ceiling(p.TotalCount / (double)p.PageSize);
        return TypedResults.Ok(new PagedResponse<TenantResponse>(
            p.Items.Select(TenantResponse.From).ToList(), p.Page, p.PageSize, p.TotalCount, totalPages));
    }

    // E-02
    private static async Task<IResult> GetAsync([AsParameters] TenantCall c)
    {
        var tenant = await c.Sender.Send(new GetTenantQuery(c.Id), c.Ct).ConfigureAwait(false);
        return tenant.IsFailure
            ? tenant.ToProblem(c.Http)
            : ETags.OkOrNotModified(c.Http, tenant.Value.Version, TenantResponse.From(tenant.Value));
    }

    // E-03: la única escritura sin If-Match, porque crea el agregado.
    private static async Task<IResult> CreateAsync([AsParameters] RootCall c, [FromBody] CreateTenantRequest? body)
    {
        body ??= new CreateTenantRequest();
        var created = await c.Sender.Send(
            new CreateTenantCommand(
                body.Code ?? string.Empty,
                body.Name ?? string.Empty,
                body.OrganizationType ?? string.Empty,
                body.CompanyReference,
                body.ParentTenantId),
            c.Ct).ConfigureAwait(false);

        return created.ToCreated(c.Http, r => new CreatedResource($"{TenantPath}/{r.Id}", r.Version, new CreatedResponse(r.Id, r.Version)));
    }

    // E-04
    private static async Task<IResult> UpdateAsync([AsParameters] TenantCall c, [FromBody] UpdateTenantRequest? body)
    {
        var precondition = ETags.ReadIfMatch(c.Http);
        if (precondition.Failure is not null)
        {
            return precondition.Failure;
        }

        body ??= new UpdateTenantRequest();
        var updated = await c.Sender.Send(
            new UpdateTenantCommand(c.Id, precondition.Version, body.Name ?? string.Empty, body.OrganizationType ?? string.Empty, body.CompanyReference),
            c.Ct).ConfigureAwait(false);
        return updated.ToNoContent(c.Http);
    }

    // E-05, E-06, E-07. El cuerpo opcional { reason } se ignora: el dominio solo lo registra en la bitácora de sede.
    private static async Task<IResult> ActAsync(TenantCall c, TenantAction action)
    {
        var precondition = ETags.ReadIfMatch(c.Http);
        if (precondition.Failure is not null)
        {
            return precondition.Failure;
        }

        var outcome = action switch
        {
            TenantAction.Suspend => await c.Sender.Send(new SuspendTenantCommand(c.Id, precondition.Version), c.Ct).ConfigureAwait(false),
            TenantAction.Activate => await c.Sender.Send(new ActivateTenantCommand(c.Id, precondition.Version), c.Ct).ConfigureAwait(false),
            _ => await c.Sender.Send(new ArchiveTenantCommand(c.Id, precondition.Version), c.Ct).ConfigureAwait(false),
        };

        return outcome.ToNoContent(c.Http);
    }
}
