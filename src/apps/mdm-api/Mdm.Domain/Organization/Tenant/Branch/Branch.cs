namespace Mdm.Domain.Organization.Tenant.Branch;

/// <summary>
/// Sede de un tenant. Es una entidad DENTRO del agregado <c>Tenant</c>: no tiene repositorio propio
/// y solo cambia a través de los verbos de la raíz, que son quienes protegen las invariantes que
/// cruzan sedes (código único) y las que cruzan tenant y sede (estado del tenant, versión).
/// Por eso sus mutaciones son <c>internal</c>.
/// </summary>
public sealed class Branch : Entity<Branch, BranchProps>
{
    private readonly List<BranchLifecycleEntry> _pendingLifecycleEntries = [];

    private Branch(BranchProps props) : base(props)
    {
        SetId(props.Id.GetValue().ToString());
    }

    public BranchId BranchId => Props.Id;

    public TenantId TenantId => Props.TenantId;

    public Code Code => Props.Code;

    public Name Name => Props.Name;

    public bool IsActive => Props.IsActive;

    /// <summary>Cerrada definitivamente: la fila y su código permanecen, la sede ya no opera.</summary>
    public bool IsClosed => Props.IsClosed;

    public DateTimeOffset? ClosedAtUtc => Props.ClosedAtUtc;

    public ActorId? ClosedBy => Props.ClosedBy;

    public AuditValueObject Audit => Props.Audit;

    /// <summary>Episodios de esta unidad de trabajo aún sin persistir.</summary>
    public IReadOnlyCollection<BranchLifecycleEntry> PendingLifecycleEntries => _pendingLifecycleEntries.AsReadOnly();

    /// <summary>
    /// Rehidrata una sede persistida. No anota episodios ni marca cambios: una relectura no puede
    /// inventar asientos que nunca ocurrieron.
    /// </summary>
    public static Branch Load(BranchSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        var branch = new Branch(BranchProps.From(snapshot));
        branch.BrokenRules.Clear();
        branch.TrackingState.MarkAsClean();
        return branch;
    }

    internal static Result<Branch> Create(TenantId tenantId, BranchRegistration registration, DateTimeOffset now)
    {
        var branch = new Branch(BranchProps.New(tenantId, registration));
        if (!branch.IsValid())
        {
            return Result<Branch>.Failure(branch.BrokenRules.FirstErrorCode());
        }

        // La apertura es el episodio cero: sin él la bitácora empezaría a media historia.
        branch.RecordEpisode(BranchLifecycleEpisode.Opened, new BranchChange(registration.CreatedBy, Reason: null, now));
        return Result<Branch>.Success(branch);
    }

    internal Result CanUpdate() => IsClosed ? Result.Failure(DomainErrors.Tenant.BranchClosed) : Result.Success();

    internal Result CanDeactivate()
    {
        if (IsClosed)
        {
            return Result.Failure(DomainErrors.Tenant.BranchClosed);
        }

        return IsActive ? Result.Success() : Result.Failure(DomainErrors.Tenant.BranchAlreadyInactive);
    }

    internal Result CanReactivate()
    {
        // El cierre es terminal: reactivar no puede ser la puerta de atrás que resucite una sede
        // cerrada. Si se vuelve a operar en esa plaza, se da de alta una sede nueva con otro código.
        if (IsClosed)
        {
            return Result.Failure(DomainErrors.Tenant.BranchClosed);
        }

        return IsActive ? Result.Failure(DomainErrors.Tenant.BranchAlreadyActive) : Result.Success();
    }

    internal Result CanClose() => IsClosed ? Result.Failure(DomainErrors.Tenant.BranchClosed) : Result.Success();

    internal void UpdateInternal(Name name, ActorId actor)
    {
        SetProps(Props.WithName(name));
        Props.Audit.Update(actor.GetValue());
    }

    internal void DeactivateInternal(BranchChange change)
    {
        SetProps(Props.WithActive(false));
        Props.Audit.Update(change.Actor.GetValue());
        RecordEpisode(BranchLifecycleEpisode.Deactivated, change);
    }

    internal void ReactivateInternal(BranchChange change)
    {
        SetProps(Props.WithActive(true));
        Props.Audit.Update(change.Actor.GetValue());
        RecordEpisode(BranchLifecycleEpisode.Reactivated, change);
    }

    internal void CloseInternal(BranchChange change)
    {
        SetProps(Props.WithClosed(change.At, change.Actor));
        Props.Audit.Update(change.Actor.GetValue());
        RecordEpisode(BranchLifecycleEpisode.Closed, change);
    }

    /// <summary>Lo invoca la raíz cuando el repositorio confirmó la transacción.</summary>
    internal void MarkLifecycleEntriesAsCommitted() => _pendingLifecycleEntries.Clear();

    private void RecordEpisode(BranchLifecycleEpisode episode, BranchChange change)
    {
        // La foto se toma DESPUÉS del cambio: el asiento de cierre guarda el nombre con el que la
        // sede llegó a su último día.
        _pendingLifecycleEntries.Add(new BranchLifecycleEntry(
            Id: Guid.NewGuid(),
            TenantId: Props.TenantId.GetValue(),
            BranchId: Props.Id.GetValue(),
            Episode: episode,
            OccurredAtUtc: change.At,
            ActorId: change.Actor.GetValue(),
            NameSnapshot: Props.Name.GetValue(),
            Reason: change.Reason));
    }
}
