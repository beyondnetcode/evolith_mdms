using System.Globalization;
using Mdm.Application.Common;
using Mdm.Application.Organization.Tenants.Queries;
using Mdm.Domain.Kernel;

namespace Mdm.Presentation.Endpoints.Organization;

/// <summary>
/// Lee la cadena de consulta de E-01 con los valores por defecto del contrato (§1.2). Un entero
/// ilegible es un error de validación del contrato, no un fallo genérico de enlace de parámetros.
/// </summary>
internal static class ListTenantsParameters
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;

    public static Result<ListTenantsQuery> Read(IQueryCollection query)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (!TryInt(query["page"], DefaultPage, out var page))
        {
            return Result<ListTenantsQuery>.Failure(ApplicationErrors.Validation.PageInvalid);
        }

        if (!TryInt(query["pageSize"], DefaultPageSize, out var pageSize))
        {
            return Result<ListTenantsQuery>.Failure(ApplicationErrors.Validation.PageSizeInvalid);
        }

        return Result<ListTenantsQuery>.Success(new ListTenantsQuery(
            page,
            pageSize,
            Text(query["status"]),
            Text(query["search"]),
            Text(query["sortBy"]) ?? "code",
            Text(query["sortOrder"]) ?? "asc"));
    }

    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private static bool TryInt(string? raw, int fallback, out int value)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            value = fallback;
            return true;
        }

        return int.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out value);
    }
}
