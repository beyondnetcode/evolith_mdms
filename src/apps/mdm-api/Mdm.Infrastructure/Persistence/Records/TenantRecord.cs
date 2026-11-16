namespace Mdm.Infrastructure.Persistence.Records;

/// <summary>
/// Fila de <c>mdm.Tenants</c>. Existe porque el agregado <c>Tenant</c> oculta la <c>Version</c> de
/// las shells con un <c>long</c>: EF Core no puede mapearlo directamente, así que se mapea esta
/// fila y se traduce con <c>Tenant.Load</c>.
/// </summary>
public sealed class TenantRecord : AuditedRecord
{
    public Guid Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int OrganizationTypeId { get; set; }

    public string? CompanyReference { get; set; }

    public Guid? ParentTenantId { get; set; }

    public int StatusId { get; set; }

    /// <summary>Token de concurrencia y <c>Sequence</c> del evento futuro (MDM-001 D4).</summary>
    public long Version { get; set; }

    public List<TenantBranchRecord> Branches { get; set; } = [];
}
