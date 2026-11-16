using Microsoft.AspNetCore.Mvc;

namespace Mdm.Presentation.Http;

/// <summary>
/// Completa los Problem Details que genera el propio framework (401, 403, 404 de ruta, excepciones) con
/// <c>type</c>, <c>instance</c> y el <c>code</c> del contrato, para que toda respuesta de error lo lleve.
/// </summary>
public static class ProblemDetailsDefaults
{
    /// <summary>Enlace estable al significado del estado en RFC 9110.</summary>
    public static string TypeFor(int status) =>
        $"https://httpwg.org/specs/rfc9110.html#status.{status}";

    public static void Apply(HttpContext http, ProblemDetails problem)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(problem);

        var status = problem.Status ?? http.Response.StatusCode;
        problem.Type = TypeFor(status);
        problem.Instance ??= http.Request.Path;
        if (problem.Extensions.ContainsKey("code"))
        {
            return;
        }

        var code = CodeFor(status);
        if (code is not null)
        {
            problem.Extensions["code"] = code;
        }
    }

    private static string? CodeFor(int status) => status switch
    {
        StatusCodes.Status400BadRequest => "request.malformed",
        StatusCodes.Status401Unauthorized => "auth.unauthenticated",
        StatusCodes.Status403Forbidden => "auth.forbidden",
        StatusCodes.Status404NotFound => "common.not_found",
        StatusCodes.Status405MethodNotAllowed => "request.method_not_allowed",
        StatusCodes.Status415UnsupportedMediaType => "request.unsupported_media_type",
        >= StatusCodes.Status500InternalServerError => "server.unexpected_error",
        _ => null,
    };
}
