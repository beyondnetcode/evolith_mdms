namespace Mdm.Presentation.Endpoints.Organization;

/// <summary>Los catorce endpoints del maestro de organización y sede bajo <c>/api/v1</c> (contrato E-01 a E-14).</summary>
public static class OrganizationEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        var api = app.MapGroup("/api/v1");
        api.MapTenantEndpoints();
        api.MapBranchEndpoints();
        return app;
    }
}
