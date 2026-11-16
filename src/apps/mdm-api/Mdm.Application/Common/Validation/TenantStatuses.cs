namespace Mdm.Application.Common.Validation;

using Mdm.Domain.Organization.Tenant;

/// <summary>Nombres válidos del filtro de estado de tenant; devuelve el nombre canónico del dominio.</summary>
internal static class TenantStatuses
{
    private static readonly Dictionary<string, string> ByName =
        new[] { TenantStatus.Active, TenantStatus.Suspended, TenantStatus.Archived }
            .ToDictionary(s => s.Name, s => s.Name, StringComparer.OrdinalIgnoreCase);

    public static bool TryNormalize(string? value, out string canonical)
    {
        canonical = string.Empty;
        return value is not null && ByName.TryGetValue(value.Trim(), out canonical!);
    }
}
