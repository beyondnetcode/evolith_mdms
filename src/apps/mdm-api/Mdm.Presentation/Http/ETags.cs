using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Net.Http.Headers;

namespace Mdm.Presentation.Http;

/// <summary>Resultado de leer <c>If-Match</c>: la versión esperada o la respuesta de error que corresponde.</summary>
public readonly record struct PreconditionOutcome(long Version, IResult? Failure);

/// <summary>
/// <c>ETag</c> fuerte <c>"&lt;versión&gt;"</c>, <c>If-Match</c> obligatorio en escrituras y
/// <c>If-None-Match</c> en lecturas (contrato §1.1).
/// </summary>
public static partial class ETags
{
    [GeneratedRegex("^\"(?<v>[0-9]{1,18})\"$", RegexOptions.None, matchTimeoutMilliseconds: 100)]
    private static partial Regex StrongVersion();

    /// <summary>Valor del <c>ETag</c> de una versión.</summary>
    public static string Format(long version) => $"\"{version.ToString(CultureInfo.InvariantCulture)}\"";

    public static void Set(HttpContext http, long version)
    {
        ArgumentNullException.ThrowIfNull(http);
        http.Response.Headers.ETag = Format(version);
    }

    /// <summary>
    /// Sin cabecera o con <c>*</c>: 428 <c>precondition.required</c>. Con un valor que no es un ETag
    /// fuerte de versión (débil, sin comillas, lista, no numérico): 400 <c>validation.failed</c>.
    /// Una versión 0 llega al caso de uso, que la rechaza como <c>validation.expected_version_invalid</c>.
    /// </summary>
    public static PreconditionOutcome ReadIfMatch(HttpContext http)
    {
        ArgumentNullException.ThrowIfNull(http);
        var values = http.Request.Headers.IfMatch;
        if (values.Count == 0 || string.IsNullOrWhiteSpace(values[0]) || values[0] == "*")
        {
            return new PreconditionOutcome(0, Problems.FromError(http, DomainErrorStatusMapper.PreconditionRequired));
        }

        var match = values.Count == 1 ? StrongVersion().Match(values[0]!.Trim()) : null;
        if (match is { Success: true } && long.TryParse(match.Groups["v"].Value, CultureInfo.InvariantCulture, out var version))
        {
            return new PreconditionOutcome(version, null);
        }

        return new PreconditionOutcome(
            0,
            Problems.FromError(http, Mdm.Application.Common.ApplicationErrors.Validation.ExpectedVersionInvalid));
    }

    /// <summary>
    /// 200 con <c>ETag</c>, o 304 sin cuerpo si <c>If-None-Match</c> contiene el ETag vigente (o <c>*</c>).
    /// </summary>
    public static IResult OkOrNotModified<T>(HttpContext http, long version, T body)
    {
        ArgumentNullException.ThrowIfNull(http);
        Set(http, version);
        return MatchesIfNoneMatch(http, version)
            ? TypedResults.StatusCode(StatusCodes.Status304NotModified)
            : TypedResults.Ok(body);
    }

    private static bool MatchesIfNoneMatch(HttpContext http, long version)
    {
        var current = new EntityTagHeaderValue(Format(version));
        return http.Request.GetTypedHeaders().IfNoneMatch
            .Any(candidate => candidate.Equals(EntityTagHeaderValue.Any) || candidate.Compare(current, useStrongComparison: false));
    }
}
