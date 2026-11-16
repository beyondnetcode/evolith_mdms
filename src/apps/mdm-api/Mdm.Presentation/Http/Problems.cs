using Microsoft.AspNetCore.Mvc;

namespace Mdm.Presentation.Http;

/// <summary>Construcción de Problem Details (RFC 9457) con la extensión <c>code</c> del contrato.</summary>
public static class Problems
{
    private const string UnexpectedCode = "server.unexpected_error";

    /// <summary>
    /// Problem Details de un código de error. Un código desconocido es un defecto nuestro, no del
    /// cliente: se registra y responde 500 en vez de disfrazarlo de 400.
    /// </summary>
    public static IResult FromError(HttpContext http, string error)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(error);

        if (!DomainErrorStatusMapper.TryMap(error, out var spec))
        {
            http.RequestServices.GetService<ILoggerFactory>()?
                .CreateLogger("Mdm.Presentation.Problems")
                .LogError("Código de error sin correspondencia HTTP: {ErrorCode} en {Method} {Path}", error, http.Request.Method, http.Request.Path);
            spec = new ProblemSpec(
                StatusCodes.Status500InternalServerError,
                UnexpectedCode,
                "Error inesperado",
                "El servidor no pudo completar la operación.");
            return Create(http, spec);
        }

        var problem = Build(http, spec);
        if (spec.Code == DomainErrorStatusMapper.ValidationFailed)
        {
            problem.Extensions["errors"] = new Dictionary<string, string[]>
            {
                [DomainErrorStatusMapper.FieldOf(error)] = [error],
            };
        }

        return TypedResults.Problem(problem);
    }

    /// <summary>Problem Details con un especificador ya resuelto (sin campo <c>errors</c>).</summary>
    public static IResult Create(HttpContext http, ProblemSpec spec) => TypedResults.Problem(Build(http, spec));

    private static ProblemDetails Build(HttpContext http, ProblemSpec spec)
    {
        var problem = new ProblemDetails
        {
            Type = ProblemDetailsDefaults.TypeFor(spec.Status),
            Title = spec.Title,
            Status = spec.Status,
            Detail = spec.Detail,
            Instance = http.Request.Path,
        };
        problem.Extensions["code"] = spec.Code;
        return problem;
    }
}
