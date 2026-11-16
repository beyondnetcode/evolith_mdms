using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Mdm.Presentation.Http;

/// <summary>
/// Un cuerpo ilegible (JSON mal formado, tipo de contenido no admitido) lo detecta el enlace de
/// parámetros y llega como <see cref="BadHttpRequestException"/>: es un error del cliente (4xx),
/// no un 500.
/// </summary>
internal sealed class BadRequestExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(httpContext);
        if (exception is not BadHttpRequestException bad)
        {
            return false;
        }

        httpContext.Response.StatusCode = bad.StatusCode;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = bad.StatusCode,
                Title = "La solicitud no se pudo leer",
                Detail = "El cuerpo o los parámetros de la solicitud no tienen el formato esperado.",
            },
        }).ConfigureAwait(false);
    }
}
