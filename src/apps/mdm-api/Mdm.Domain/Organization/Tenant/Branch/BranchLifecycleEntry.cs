namespace Mdm.Domain.Organization.Tenant.Branch;

/// <summary>
/// Asiento de la bitácora de una sede: qué ocurrió, cuándo, quién y cómo se llamaba la sede en ese
/// instante. Responde «¿cómo estaba la sede cuando salió este despacho?», que el estado actual no
/// puede contestar.
///
/// <para>Inmutable y append-only: no se corrige ni se borra. El agregado lo deja pendiente y el
/// repositorio lo persiste en la MISMA transacción que el cambio de estado, para que la bitácora no
/// pierda episodios. La historia no se carga con el agregado: ninguna invariante depende de ella.</para>
/// </summary>
public sealed record BranchLifecycleEntry(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    BranchLifecycleEpisode Episode,
    DateTimeOffset OccurredAtUtc,
    string ActorId,
    string NameSnapshot,
    string? Reason)
{
    /// <summary>Longitud máxima del motivo declarado; coincide con la columna de UMS.</summary>
    public const int ReasonMaxLength = 500;
}
