namespace Mdm.Domain.Organization.Tenant.Branch;

/// <summary>
/// Episodio del ciclo de vida de una sede. Mismos identificadores que UMS; se persisten, así que
/// se añaden episodios nuevos pero no se renumeran los existentes.
/// </summary>
public sealed class BranchLifecycleEpisode : DomainEnumeration
{
    /// <summary>Alta: la sede empieza a operar.</summary>
    public static readonly BranchLifecycleEpisode Opened = new(1, nameof(Opened));

    /// <summary>Pausa reversible: deja de operar pero sigue existiendo.</summary>
    public static readonly BranchLifecycleEpisode Deactivated = new(2, nameof(Deactivated));

    /// <summary>Vuelve a operar tras una pausa.</summary>
    public static readonly BranchLifecycleEpisode Reactivated = new(3, nameof(Reactivated));

    /// <summary>Cierre definitivo (terminal).</summary>
    public static readonly BranchLifecycleEpisode Closed = new(4, nameof(Closed));

    private BranchLifecycleEpisode(int id, string name) : base(id, name)
    {
    }
}
