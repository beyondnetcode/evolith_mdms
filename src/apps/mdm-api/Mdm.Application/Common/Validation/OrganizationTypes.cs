namespace Mdm.Application.Common.Validation;

using Mdm.Domain.Organization.Tenant;

/// <summary>Traduce el nombre público de un tipo de organización (sin distinguir mayúsculas) a su valor de dominio.</summary>
internal static class OrganizationTypes
{
    private static readonly Dictionary<string, OrganizationType> ByName =
        new[] { OrganizationType.INTERNAL, OrganizationType.SUPPLIER, OrganizationType.CLIENT }
            .ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);

    public static bool TryParse(string? value, out OrganizationType type)
    {
        type = null!;
        return value is not null && ByName.TryGetValue(value.Trim(), out type!);
    }
}
