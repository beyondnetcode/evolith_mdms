namespace Mdm.Infrastructure.Persistence.Records;

/// <summary>
/// Columnas de auditoría que el agregado ya calcula (<c>AuditProps</c> de las shells). La
/// infraestructura las copia tal cual: no hay interceptor que las sellen por su cuenta, porque
/// quien actúa lo conoce el dominio y no el DbContext.
/// </summary>
public abstract class AuditedRecord
{
    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    /// <summary>Campo <c>TimeSpan</c> de <c>AuditProps</c>, que el dominio escribe como texto.</summary>
    public string AuditTimeSpan { get; set; } = string.Empty;
}
