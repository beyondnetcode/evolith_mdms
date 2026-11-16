namespace Mdm.Domain.Organization.Tenant;

/// <summary>
/// Estado del maestro organización. Solo contiene atributos de MAESTRO: los de identidad
/// (estrategia de IdP, visibilidad en el login, parámetros) siguen en UMS.
/// Inmutable desde fuera: cada cambio produce una copia con <c>WithX</c>.
/// </summary>
public sealed class TenantProps : IProps
{
    // Las fábricas de esta misma clase (New, From) asignan todas las propiedades obligatorias con
    // un inicializador de objeto; el constructor vacío es privado para que nadie más pueda hacerlo.
#pragma warning disable CS8618
    private TenantProps()
    {
    }
#pragma warning restore CS8618

    public TenantId Id { get; private set; }

    /// <summary>Normalizado, único entre todos los tenants (incluidos los archivados) e inmutable.</summary>
    public Code Code { get; private set; }

    public Name Name { get; private set; }

    public OrganizationType Type { get; private set; }

    public CompanyReference? CompanyReference { get; private set; }

    /// <summary>Organización matriz; se fija al crear y no cambia.</summary>
    public TenantId? ParentTenantId { get; private set; }

    public TenantStatus Status { get; private set; }

    public AuditValueObject Audit { get; private set; }

    internal static TenantProps New(TenantId id, NewTenant data, ActorId createdBy)
    {
        return new TenantProps
        {
            Id = id,
            Code = data.Code,
            Name = data.Name,
            Type = data.Type,
            CompanyReference = data.CompanyReference,
            ParentTenantId = data.ParentTenantId,
            Status = TenantStatus.Active,
            Audit = AuditValueObject.Create(createdBy.GetValue()),
        };
    }

    internal static TenantProps From(TenantSnapshot snapshot)
    {
        return new TenantProps
        {
            Id = TenantId.Load(snapshot.Id),
            Code = Code.Create(snapshot.Code),
            Name = Name.Create(snapshot.Name),
            Type = EnumerationOf<OrganizationType>(snapshot.OrganizationTypeId),
            CompanyReference = string.IsNullOrWhiteSpace(snapshot.CompanyReference)
                ? null
                : CompanyReference.Create(snapshot.CompanyReference),
            ParentTenantId = snapshot.ParentTenantId is { } parentId ? TenantId.Load(parentId) : null,
            Status = EnumerationOf<TenantStatus>(snapshot.StatusId),
            Audit = AuditValueObject.Load(snapshot.Audit),
        };
    }

    internal TenantProps WithGeneralData(TenantGeneralData data)
    {
        var clone = Copy();
        clone.Name = data.Name;
        clone.Type = data.Type;
        clone.CompanyReference = data.CompanyReference;
        return clone;
    }

    internal TenantProps WithStatus(TenantStatus status)
    {
        var clone = Copy();
        clone.Status = status;
        return clone;
    }

    public object Clone() => MemberwiseClone();

    private TenantProps Copy() => (TenantProps)MemberwiseClone();

    /// <summary>
    /// Un identificador desconocido en una fila persistida es corrupción de datos, no una regla de
    /// negocio: se falla de inmediato en vez de rehidratar un agregado sin estado.
    /// </summary>
    private static T EnumerationOf<T>(int id) where T : DomainEnumeration
    {
        return DomainEnumeration.FromValue<T>(id)
            ?? throw new InvalidOperationException($"Identificador {id} desconocido para {typeof(T).Name}.");
    }
}
