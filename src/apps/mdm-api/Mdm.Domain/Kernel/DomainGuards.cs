namespace Mdm.Domain.Kernel;

public static class DomainGuards
{
    /// <summary>
    /// Forma canónica de un código de negocio: sin espacios en los extremos, en mayúsculas
    /// invariantes y con los espacios interiores convertidos en guion bajo. Es la misma regla que
    /// UMS, para que un código importado desde allí no cambie de forma.
    /// </summary>
    public static string NormalizeCode(string? value)
    {
        return (value ?? string.Empty).Trim().ToUpperInvariant().Replace(' ', '_');
    }

    /// <summary>Texto libre opcional: nulo si viene vacío o solo con espacios; recortado si no.</summary>
    public static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
