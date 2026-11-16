using MediatR;
using Microsoft.AspNetCore.Mvc;
using Mdm.Application.Organization.Branches.Commands;
using Mdm.Application.Organization.Branches.Queries;
using Mdm.Application.Organization.DTOs;
using Mdm.Application.Organization.Tenants.Queries;
using Mdm.Domain.Kernel;
using Mdm.Presentation.Http;

namespace Mdm.Presentation.Endpoints.Organization;

/// <summary>E-08 a E-14 del contrato: sede (<c>Branch</c>) dentro del agregado de su organización.</summary>
internal static class BranchEndpoints
{
    private enum BranchAction
    {
        Deactivate,
        Reactivate,
        Close,
    }

    public static RouteGroupBuilder MapBranchEndpoints(this RouteGroupBuilder api)
    {
        var branches = api.MapGroup("/tenants/{id:guid}/branches").WithTags("Branches");
        branches.MapGet("/", ListAsync);
        branches.MapGet("/{branchId:guid}", GetAsync);
        branches.MapPost("/", AddAsync);
        branches.MapPut("/{branchId:guid}", UpdateAsync);
        branches.MapPost("/{branchId:guid}/deactivate", ([AsParameters] BranchCall c, [FromBody] ActionRequest? body) => ActAsync(c, BranchAction.Deactivate, body));
        branches.MapPost("/{branchId:guid}/reactivate", ([AsParameters] BranchCall c, [FromBody] ActionRequest? body) => ActAsync(c, BranchAction.Reactivate, body));
        branches.MapDelete("/{branchId:guid}", ([AsParameters] BranchCall c, [FromBody] ActionRequest? body) => ActAsync(c, BranchAction.Close, body));
        return api;
    }

    // E-08: sin status, todas las sedes (también las cerradas).
    private static async Task<IResult> ListAsync([AsParameters] TenantCall c)
    {
        var status = ParseStatus(c.Http.Request.Query["status"]);
        if (status.IsFailure)
        {
            return status.ToProblem(c.Http);
        }

        var list = await c.Sender.Send(new ListBranchesQuery(c.Id, status.Value), c.Ct).ConfigureAwait(false);
        if (list.IsFailure)
        {
            return list.ToProblem(c.Http);
        }

        var version = await TenantVersionAsync(c, list.Value).ConfigureAwait(false);
        return version.IsFailure
            ? version.ToProblem(c.Http)
            : ETags.OkOrNotModified(c.Http, version.Value, list.Value.Select(BranchResponse.From).ToList());
    }

    // E-09
    private static async Task<IResult> GetAsync([AsParameters] BranchCall c)
    {
        var branch = await c.Sender.Send(new GetBranchQuery(c.Id, c.BranchId), c.Ct).ConfigureAwait(false);
        return branch.IsFailure
            ? branch.ToProblem(c.Http)
            : ETags.OkOrNotModified(c.Http, branch.Value.TenantVersion, BranchResponse.From(branch.Value));
    }

    // E-10
    private static async Task<IResult> AddAsync([AsParameters] TenantCall c, [FromBody] CreateBranchRequest? body)
    {
        var precondition = ETags.ReadIfMatch(c.Http);
        if (precondition.Failure is not null)
        {
            return precondition.Failure;
        }

        body ??= new CreateBranchRequest();
        var added = await c.Sender.Send(
            new AddBranchCommand(c.Id, precondition.Version, body.Code ?? string.Empty, body.Name ?? string.Empty),
            c.Ct).ConfigureAwait(false);

        return added.ToCreated(c.Http, r => new CreatedResource(
            $"/api/v1/tenants/{c.Id}/branches/{r.BranchId}", r.TenantVersion, new CreatedResponse(r.BranchId, r.TenantVersion)));
    }

    // E-11
    private static async Task<IResult> UpdateAsync([AsParameters] BranchCall c, [FromBody] UpdateBranchRequest? body)
    {
        var precondition = ETags.ReadIfMatch(c.Http);
        if (precondition.Failure is not null)
        {
            return precondition.Failure;
        }

        body ??= new UpdateBranchRequest();
        var updated = await c.Sender.Send(
            new UpdateBranchCommand(c.Id, c.BranchId, precondition.Version, body.Name ?? string.Empty),
            c.Ct).ConfigureAwait(false);
        return updated.ToNoContent(c.Http);
    }

    // E-12, E-13, E-14
    private static async Task<IResult> ActAsync(BranchCall c, BranchAction action, [FromBody] ActionRequest? body)
    {
        var precondition = ETags.ReadIfMatch(c.Http);
        if (precondition.Failure is not null)
        {
            return precondition.Failure;
        }

        var reason = body?.Reason;
        var outcome = action switch
        {
            BranchAction.Deactivate => await c.Sender.Send(new DeactivateBranchCommand(c.Id, c.BranchId, precondition.Version, reason), c.Ct).ConfigureAwait(false),
            BranchAction.Reactivate => await c.Sender.Send(new ReactivateBranchCommand(c.Id, c.BranchId, precondition.Version, reason), c.Ct).ConfigureAwait(false),
            _ => await c.Sender.Send(new CloseBranchCommand(c.Id, c.BranchId, precondition.Version, reason), c.Ct).ConfigureAwait(false),
        };

        return outcome.ToNoContent(c.Http);
    }

    private static Result<BranchStatusFilter> ParseStatus(string? raw) =>
        raw?.Trim().ToUpperInvariant() switch
        {
            null or "" => Result<BranchStatusFilter>.Success(BranchStatusFilter.All),
            "ACTIVE" => Result<BranchStatusFilter>.Success(BranchStatusFilter.Active),
            "INACTIVE" => Result<BranchStatusFilter>.Success(BranchStatusFilter.Inactive),
            "CLOSED" => Result<BranchStatusFilter>.Success(BranchStatusFilter.Closed),
            _ => Result<BranchStatusFilter>.Failure(Mdm.Application.Common.ApplicationErrors.Validation.StatusInvalid),
        };

    // La sede no tiene versión propia: el ETag es el de la organización. Una lista vacía no la trae.
    private static async Task<Result<long>> TenantVersionAsync(TenantCall c, IReadOnlyList<BranchDto> branches)
    {
        if (branches.Count > 0)
        {
            return Result<long>.Success(branches[0].TenantVersion);
        }

        var tenant = await c.Sender.Send(new GetTenantQuery(c.Id), c.Ct).ConfigureAwait(false);
        return tenant.IsFailure ? Result<long>.Failure(tenant.Error) : Result<long>.Success(tenant.Value.Version);
    }
}
