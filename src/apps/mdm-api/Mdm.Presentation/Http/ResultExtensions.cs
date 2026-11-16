using Microsoft.AspNetCore.Mvc;
using Mdm.Domain.Kernel;

namespace Mdm.Presentation.Http;

/// <summary>Resultado correcto de un alta: dónde está el recurso, su ETag y el cuerpo.</summary>
public readonly record struct CreatedResource(string Location, long Version, object Body);

/// <summary>Traducción de <see cref="Result"/> a respuestas HTTP según el contrato (ETag, 204, 201, Problem Details).</summary>
public static class ResultExtensions
{
    /// <summary>204 con el nuevo <c>ETag</c>, o el Problem Details del fallo.</summary>
    public static IResult ToNoContent(this Result<long> result, HttpContext http)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(http);
        if (result.IsFailure)
        {
            return result.ToProblem(http);
        }

        ETags.Set(http, result.Value);
        return TypedResults.NoContent();
    }

    /// <summary>201 con <c>Location</c> y <c>ETag</c>, o el Problem Details del fallo.</summary>
    public static IResult ToCreated<T>(this Result<T> result, HttpContext http, Func<T, CreatedResource> map)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(map);
        if (result.IsFailure)
        {
            return result.ToProblem(http);
        }

        var created = map(result.Value);
        ETags.Set(http, created.Version);
        return TypedResults.Created(created.Location, created.Body);
    }

    /// <summary>Problem Details (RFC 9457) del código de error del resultado, con la extensión <c>code</c>.</summary>
    public static IResult ToProblem(this Result result, HttpContext http)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(http);
        if (result.IsSuccess)
        {
            throw new InvalidOperationException("Un resultado exitoso no tiene Problem Details.");
        }

        return Problems.FromError(http, result.Error);
    }
}
