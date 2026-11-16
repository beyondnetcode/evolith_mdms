namespace Mdm.Infrastructure.Persistence;

/// <summary>
/// Conversión entre el <c>DateTime</c> de <c>AuditProps</c> (las shells) y el <c>datetimeoffset</c>
/// de las columnas. Todo instante se persiste en UTC (MDM-001 D2).
/// </summary>
internal static class Instants
{
    public static DateTimeOffset ToOffset(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => new DateTimeOffset(value),
        DateTimeKind.Local => new DateTimeOffset(value.ToUniversalTime()),
        // Las shells escriben DateTime.UtcNow; un valor sin Kind (p. ej. de una importación) se toma como UTC.
        _ => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)),
    };

    public static DateTimeOffset? ToOffset(DateTime? value) => value is { } v ? ToOffset(v) : null;

    public static DateTime ToUtcDateTime(DateTimeOffset value) => value.UtcDateTime;

    public static DateTime? ToUtcDateTime(DateTimeOffset? value) => value?.UtcDateTime;
}
