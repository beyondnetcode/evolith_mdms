namespace Mdm.Presentation.Endpoints.Health;

/// <summary>Sonda de vida del servicio MDM. No consulta dependencias: solo dice que el proceso responde.</summary>
public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/health").WithTags("Health").AllowAnonymous();
        group.MapGet("/", () => TypedResults.Ok(new HealthResponse("ok")));
        return app;
    }
}

/// <summary>Cuerpo de la sonda de vida.</summary>
public sealed record HealthResponse(string Estado);
