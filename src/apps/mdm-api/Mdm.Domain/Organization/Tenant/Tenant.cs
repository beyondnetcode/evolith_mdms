namespace Mdm.Domain.Organization.Tenant;

using Mdm.Domain.Organization.Tenant.Branch;
using Mdm.Domain.Organization.Tenant.Events;
using BranchEntity = Mdm.Domain.Organization.Tenant.Branch.Branch;

/// <summary>
/// Raíz del agregado organización: el tenant y sus sedes. MDM es el dueño del maestro; UMS lo
/// proyectará (D-031, plan T2).
///
/// <para><b>Versión.</b> <see cref="Version"/> sube en TODA mutación que tiene éxito, también en las
/// de una sede: la sede no tiene concurrencia propia, así que su ETag es la versión del agregado y
/// dos escrituras concurrentes sobre sedes distintas del mismo tenant se detectan igual.</para>
///
/// <para><b>Errores.</b> Cada verbo valida TODO antes de mutar nada y, si algo falla, devuelve el
/// código de la primera regla rota sin tocar el estado ni la versión.</para>
/// </summary>
public sealed class Tenant : AggregateRoot<Tenant, TenantProps>
{
    private readonly List<BranchEntity> _branches = [];

    private Tenant(TenantProps props, long version) : base(props)
    {
        SetId(props.Id.GetValue().ToString());
        Version = version;
        PersistedVersion = version;
    }

    /// <summary>
    /// Versión del agregado (token de concurrencia y ETag). Oculta a la de la shell, que es
    /// <c>int</c>: la columna es <c>bigint</c>. La heredada no se usa.
    /// </summary>
    public new long Version { get; private set; }

    /// <summary>
    /// Versión con la que el agregado se leyó (o 0 si es nuevo). El repositorio la usa como valor
    /// esperado de la concurrencia optimista: <c>UPDATE … WHERE Version = PersistedVersion</c>.
    /// </summary>
    public long PersistedVersion { get; private set; }

    public TenantId TenantId => Props.Id;

    public Code Code => Props.Code;

    public Name Name => Props.Name;

    public OrganizationType Type => Props.Type;

    public CompanyReference? CompanyReference => Props.CompanyReference;

    public TenantId? ParentTenantId => Props.ParentTenantId;

    public TenantStatus Status => Props.Status;

    public AuditValueObject Audit => Props.Audit;

    /// <summary>
    /// TODAS las sedes, incluidas las cerradas: la colección no encoge nunca, porque el código de una
    /// sede cerrada sigue ocupado y la historia debe poder resolverla por id. Quien liste para una
    /// persona filtra por <c>!IsClosed</c>.
    /// </summary>
    public IReadOnlyCollection<BranchEntity> Branches => _branches.AsReadOnly();

    /// <summary>Asientos de bitácora de todas las sedes pendientes de persistir en esta unidad de trabajo.</summary>
    public IReadOnlyCollection<BranchLifecycleEntry> PendingBranchLifecycleEntries =>
        _branches.SelectMany(b => b.PendingLifecycleEntries).ToList().AsReadOnly();

    private bool HasActiveBranches => _branches.Exists(b => b.IsActive && !b.IsClosed);

    private bool HasBrokenRules => BrokenRules.GetBrokenRules().Count > 0;

    /// <summary>Alta de un tenant. Nace <see cref="TenantStatus.Active"/>, sin sedes y con versión 1.</summary>
    public static Result<Tenant> Create(NewTenant data, ActorId createdBy)
    {
        ArgumentNullException.ThrowIfNull(data);
        var tenantId = data.Id ?? TenantId.Create();
        var tenant = new Tenant(TenantProps.New(tenantId, data, createdBy), version: 0);
        tenant.BrokenRules.AddBrokenRulesOf(createdBy);

        if (data.Type is null)
        {
            tenant.BrokenRules.Add(new BrokenRule(nameof(Type), DomainErrors.Tenant.OrganizationTypeRequired));
        }

        if (data.ParentTenantId is not null && data.ParentTenantId.GetValue() == tenantId.GetValue())
        {
            tenant.BrokenRules.Add(new BrokenRule(nameof(ParentTenantId), DomainErrors.Tenant.ParentInvalid));
        }

        if (!tenant.IsValid())
        {
            return Result<Tenant>.Failure(tenant.BrokenRules.FirstErrorCode());
        }

        tenant.Version = 1;
        tenant.DomainEvents.RaiseEvent(new TenantCreatedEvent(
            tenantId.GetValue(), tenant.Version, data.Code.GetValue(), data.Name.GetValue()));
        return Result<Tenant>.Success(tenant);
    }

    /// <summary>
    /// Rehidrata un tenant persistido con sus sedes y su versión. No emite eventos ni anota bitácora.
    /// </summary>
    public static Tenant Load(TenantSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);

        var tenant = new Tenant(TenantProps.From(snapshot), snapshot.Version);
        tenant._branches.AddRange(snapshot.Branches.Select(BranchEntity.Load));
        tenant.BrokenRules.Clear();
        tenant.DomainEvents.MarkChangesAsCommitted();
        tenant.TrackingState.MarkAsClean();
        return tenant;
    }

    /// <summary>Edita los datos generales. El código y la matriz no cambian.</summary>
    public Result UpdateGeneralData(TenantGeneralData data, ActorId updatedBy)
    {
        ArgumentNullException.ThrowIfNull(data);
        BeginOperation(updatedBy);
        BrokenRules.AddBrokenRulesOf(data.Name);
        BrokenRules.AddBrokenRulesOf(data.CompanyReference);
        if (data.Type is null)
        {
            BrokenRules.Add(new BrokenRule(nameof(Type), DomainErrors.Tenant.OrganizationTypeRequired));
        }

        EnsureNotArchived();
        if (HasBrokenRules)
        {
            return Fail();
        }

        SetProps(Props.WithGeneralData(data));
        Touch(updatedBy);
        DomainEvents.RaiseEvent(new TenantUpdatedEvent(Props.Id.GetValue(), Version));
        return Result.Success();
    }

    /// <summary>Active → Suspended. Exige que no queden sedes activas sin cerrar.</summary>
    public Result Suspend(ActorId updatedBy)
    {
        BeginOperation(updatedBy);
        if (Props.Status != TenantStatus.Active)
        {
            BrokenRules.Add(new BrokenRule(
                nameof(Status),
                Props.Status == TenantStatus.Archived ? DomainErrors.Tenant.Archived : DomainErrors.Tenant.AlreadySuspended));
        }
        else if (HasActiveBranches)
        {
            BrokenRules.Add(new BrokenRule(nameof(Branches), DomainErrors.Tenant.HasActiveBranches));
        }

        return HasBrokenRules
            ? Fail()
            : ChangeStatus(TenantStatus.Suspended, updatedBy, v => new TenantSuspendedEvent(Props.Id.GetValue(), v));
    }

    /// <summary>Suspended → Active. Un tenant archivado no se reactiva.</summary>
    public Result Activate(ActorId updatedBy)
    {
        BeginOperation(updatedBy);
        if (Props.Status != TenantStatus.Suspended)
        {
            BrokenRules.Add(new BrokenRule(
                nameof(Status),
                Props.Status == TenantStatus.Archived ? DomainErrors.Tenant.Archived : DomainErrors.Tenant.AlreadyActive));
        }

        return HasBrokenRules
            ? Fail()
            : ChangeStatus(TenantStatus.Active, updatedBy, v => new TenantActivatedEvent(Props.Id.GetValue(), v));
    }

    /// <summary>
    /// Active | Suspended → Archived (terminal; es el «borrado» lógico del maestro y el código queda
    /// ocupado). Exige que no queden sedes activas sin cerrar.
    /// </summary>
    public Result Archive(ActorId updatedBy)
    {
        BeginOperation(updatedBy);
        if (Props.Status == TenantStatus.Archived)
        {
            BrokenRules.Add(new BrokenRule(nameof(Status), DomainErrors.Tenant.Archived));
        }
        else if (HasActiveBranches)
        {
            BrokenRules.Add(new BrokenRule(nameof(Branches), DomainErrors.Tenant.HasActiveBranches));
        }

        return HasBrokenRules
            ? Fail()
            : ChangeStatus(TenantStatus.Archived, updatedBy, v => new TenantArchivedEvent(Props.Id.GetValue(), v));
    }

    /// <summary>
    /// Alta de una sede. El tenant debe estar activo. El código no puede repetirse dentro del tenant,
    /// TAMPOCO respecto de una sede cerrada: liberarlo dejaría dos sedes con el mismo código y la
    /// historia no sabría a cuál se refiere.
    /// </summary>
    public Result<BranchEntity> AddBranch(Code code, Name name, ActorId createdBy)
    {
        BeginOperation(createdBy);
        BrokenRules.AddBrokenRulesOf(code);
        BrokenRules.AddBrokenRulesOf(name);
        EnsureActive();
        if (_branches.Exists(b => b.Code.Equals(code)))
        {
            BrokenRules.Add(new BrokenRule(nameof(Branches), DomainErrors.Tenant.BranchCodeNotUnique));
        }

        if (HasBrokenRules)
        {
            return Result<BranchEntity>.Failure(BrokenRules.FirstErrorCode());
        }

        var created = BranchEntity.Create(Props.Id, new BranchRegistration(code, name, createdBy), Now());
        if (created.IsFailure)
        {
            return created;
        }

        _branches.Add(created.Value);
        Touch(createdBy);
        DomainEvents.RaiseEvent(new BranchCreatedEvent(Props.Id.GetValue(), Version, created.Value.BranchId.GetValue(), code.GetValue()));
        return created;
    }

    /// <summary>Edita el nombre de una sede. El código de sede no cambia. Una sede cerrada no se edita.</summary>
    public Result UpdateBranch(BranchId branchId, Name name, ActorId updatedBy)
    {
        BeginOperation(updatedBy);
        BrokenRules.AddBrokenRulesOf(name);
        EnsureNotArchived();
        var branch = FindBranch(branchId, b => b.CanUpdate());
        if (HasBrokenRules)
        {
            return Fail();
        }

        branch!.UpdateInternal(name, updatedBy);
        Touch(updatedBy);
        DomainEvents.RaiseEvent(new BranchUpdatedEvent(Props.Id.GetValue(), Version, branch.BranchId.GetValue()));
        return Result.Success();
    }

    /// <summary>Pausa reversible de una sede activa. Se admite en cualquier estado del tenant: reduce actividad.</summary>
    public Result DeactivateBranch(BranchId branchId, ActorId updatedBy, string? reason = null)
    {
        BeginOperation(updatedBy);
        var normalizedReason = ValidateReason(reason);
        var branch = FindBranch(branchId, b => b.CanDeactivate());
        if (HasBrokenRules)
        {
            return Fail();
        }

        branch!.DeactivateInternal(new BranchChange(updatedBy, normalizedReason, Now()));
        Touch(updatedBy);
        DomainEvents.RaiseEvent(new BranchDeactivatedEvent(Props.Id.GetValue(), Version, branch.BranchId.GetValue()));
        return Result.Success();
    }

    /// <summary>
    /// Vuelve a poner en servicio una sede inactiva. Exige el tenant activo: un tenant suspendido o
    /// archivado no puede tener sedes activas. Una sede cerrada no se reactiva.
    /// </summary>
    public Result ReactivateBranch(BranchId branchId, ActorId updatedBy, string? reason = null)
    {
        BeginOperation(updatedBy);
        var normalizedReason = ValidateReason(reason);
        EnsureActive();
        var branch = FindBranch(branchId, b => b.CanReactivate());
        if (HasBrokenRules)
        {
            return Fail();
        }

        branch!.ReactivateInternal(new BranchChange(updatedBy, normalizedReason, Now()));
        Touch(updatedBy);
        DomainEvents.RaiseEvent(new BranchReactivatedEvent(Props.Id.GetValue(), Version, branch.BranchId.GetValue()));
        return Result.Success();
    }

    /// <summary>
    /// Cierre DEFINITIVO de una sede (terminal): la sede deja de operar, su fila y su código
    /// permanecen y ya no admite editarse, desactivarse ni reactivarse. Distinto de desactivar, que
    /// es una pausa. Se admite en cualquier estado del tenant: solo reduce actividad.
    /// </summary>
    public Result CloseBranch(BranchId branchId, ActorId closedBy, string? reason = null)
    {
        BeginOperation(closedBy);
        var normalizedReason = ValidateReason(reason);
        var branch = FindBranch(branchId, b => b.CanClose());
        if (HasBrokenRules)
        {
            return Fail();
        }

        branch!.CloseInternal(new BranchChange(closedBy, normalizedReason, Now()));
        Touch(closedBy);
        DomainEvents.RaiseEvent(new BranchClosedEvent(Props.Id.GetValue(), Version, branch.BranchId.GetValue(), branch.Code.GetValue()));
        return Result.Success();
    }

    /// <summary>
    /// Lo llama el repositorio tras confirmar la transacción: vacía eventos y bitácora pendientes y
    /// fija la versión persistida como nueva base de la concurrencia optimista.
    /// </summary>
    public void MarkAsPersisted()
    {
        DomainEvents.MarkChangesAsCommitted();
        foreach (var branch in _branches)
        {
            branch.MarkLifecycleEntriesAsCommitted();
        }

        PersistedVersion = Version;
        TrackingState.MarkAsClean();
    }

    private static DateTimeOffset Now() => TimeProvider.System.GetUtcNow();

    private void BeginOperation(ActorId actor)
    {
        // La shell acumula reglas rotas entre llamadas; cada verbo parte de cero para que el fallo
        // de una operación anterior no contamine a la siguiente.
        BrokenRules.Clear();
        BrokenRules.AddBrokenRulesOf(actor);
    }

    private Result Fail() => Result.Failure(BrokenRules.FirstErrorCode());

    private void EnsureNotArchived()
    {
        if (Props.Status == TenantStatus.Archived)
        {
            BrokenRules.Add(new BrokenRule(nameof(Status), DomainErrors.Tenant.Archived));
        }
    }

    private void EnsureActive()
    {
        if (Props.Status == TenantStatus.Archived)
        {
            BrokenRules.Add(new BrokenRule(nameof(Status), DomainErrors.Tenant.Archived));
        }
        else if (Props.Status != TenantStatus.Active)
        {
            BrokenRules.Add(new BrokenRule(nameof(Status), DomainErrors.Tenant.NotActive));
        }
    }

    private string? ValidateReason(string? reason)
    {
        var normalized = DomainGuards.NormalizeOptionalText(reason);
        if (normalized is { Length: > BranchLifecycleEntry.ReasonMaxLength })
        {
            BrokenRules.Add(new BrokenRule(nameof(reason), DomainErrors.Validation.ReasonTooLong));
        }

        return normalized;
    }

    /// <summary>Busca la sede y aplica la guarda de la transición; registra la regla rota si falla.</summary>
    private BranchEntity? FindBranch(BranchId branchId, Func<BranchEntity, Result> guard)
    {
        var branch = _branches.Find(b => b.BranchId.GetValue() == branchId.GetValue());
        if (branch is null)
        {
            BrokenRules.Add(new BrokenRule(nameof(Branches), DomainErrors.Tenant.BranchNotFound));
            return null;
        }

        var allowed = guard(branch);
        if (allowed.IsFailure)
        {
            BrokenRules.Add(new BrokenRule(nameof(Branches), allowed.Error));
        }

        return branch;
    }

    private Result ChangeStatus(TenantStatus status, ActorId actor, Func<long, IDomainEvent> eventFor)
    {
        SetProps(Props.WithStatus(status));
        Touch(actor);
        DomainEvents.RaiseEvent(eventFor(Version));
        return Result.Success();
    }

    /// <summary>Toda mutación con éxito pasa por aquí: sube la versión y sella la auditoría.</summary>
    private void Touch(ActorId actor)
    {
        Version++;
        Props.Audit.Update(actor.GetValue());
        TrackingState.MarkAsDirty();
    }
}
