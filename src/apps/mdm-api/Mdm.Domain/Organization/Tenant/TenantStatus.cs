namespace Mdm.Domain.Organization.Tenant;

/// <summary>
/// Estado de un tenant. Transiciones válidas: Active ⇄ Suspended; Active | Suspended → Archived.
/// Archived es terminal. Los identificadores se persisten: se añaden, no se renumeran.
/// </summary>
public sealed class TenantStatus : DomainEnumeration
{
    public static readonly TenantStatus Active = new(1, nameof(Active));
    public static readonly TenantStatus Suspended = new(2, nameof(Suspended));
    public static readonly TenantStatus Archived = new(3, nameof(Archived));

    private TenantStatus(int id, string name) : base(id, name)
    {
    }
}
