namespace Mdm.Domain.Organization.Tenant.Branch;

/// <summary>
/// Estado de una sede. Inmutable desde fuera: cada cambio produce una copia con <c>WithX</c> que
/// la entidad adopta con <c>SetProps</c>.
///
/// <para><see cref="IsActive"/> e <see cref="IsClosed"/> son ejes independientes: inactiva es una
/// pausa reversible; cerrada es terminal. Colgar el cierre de <see cref="IsActive"/> permitiría
/// resucitar una sede cerrada con una simple reactivación.</para>
/// </summary>
public sealed class BranchProps : IProps
{
    // Las fábricas de esta misma clase (New, From) asignan todas las propiedades obligatorias con
    // un inicializador de objeto; el constructor vacío es privado para que nadie más pueda hacerlo.
#pragma warning disable CS8618
    private BranchProps()
    {
    }
#pragma warning restore CS8618

    public BranchId Id { get; private set; }

    public TenantId TenantId { get; private set; }

    /// <summary>Único dentro del tenant, incluidas las sedes cerradas; inmutable.</summary>
    public Code Code { get; private set; }

    public Name Name { get; private set; }

    public bool IsActive { get; private set; }

    public bool IsClosed { get; private set; }

    public DateTimeOffset? ClosedAtUtc { get; private set; }

    public ActorId? ClosedBy { get; private set; }

    public AuditValueObject Audit { get; private set; }

    internal static BranchProps New(TenantId tenantId, BranchRegistration registration)
    {
        return new BranchProps
        {
            Id = BranchId.Create(),
            TenantId = tenantId,
            Code = registration.Code,
            Name = registration.Name,
            IsActive = true,
            Audit = AuditValueObject.Create(registration.CreatedBy.GetValue()),
        };
    }

    internal static BranchProps From(BranchSnapshot snapshot)
    {
        return new BranchProps
        {
            Id = BranchId.Load(snapshot.Id),
            TenantId = TenantId.Load(snapshot.TenantId),
            Code = Code.Create(snapshot.Code),
            Name = Name.Create(snapshot.Name),
            IsActive = snapshot.IsActive,
            IsClosed = snapshot.IsClosed,
            ClosedAtUtc = snapshot.ClosedAtUtc,
            ClosedBy = string.IsNullOrWhiteSpace(snapshot.ClosedBy) ? null : ActorId.Create(snapshot.ClosedBy),
            Audit = AuditValueObject.Load(snapshot.Audit),
        };
    }

    internal BranchProps WithName(Name name)
    {
        var clone = Copy();
        clone.Name = name;
        return clone;
    }

    internal BranchProps WithActive(bool isActive)
    {
        var clone = Copy();
        clone.IsActive = isActive;
        return clone;
    }

    /// <summary>Cierre: marca el estado terminal y apaga <see cref="IsActive"/> como consecuencia.</summary>
    internal BranchProps WithClosed(DateTimeOffset closedAtUtc, ActorId closedBy)
    {
        var clone = Copy();
        clone.IsClosed = true;
        clone.IsActive = false;
        clone.ClosedAtUtc = closedAtUtc;
        clone.ClosedBy = closedBy;
        return clone;
    }

    public object Clone() => MemberwiseClone();

    private BranchProps Copy() => (BranchProps)MemberwiseClone();
}
