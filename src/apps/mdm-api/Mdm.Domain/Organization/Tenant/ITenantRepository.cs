namespace Mdm.Domain.Organization.Tenant;

/// <summary>
/// Puerto de persistencia del agregado Tenant (sus sedes viajan con él). Vive en el dominio porque
/// habla en términos del agregado; lo implementa la infraestructura.
///
/// <para>Solo cubre la vía de ESCRITURA. Los listados paginados y filtrados son lecturas (CQRS) y su
/// puerto es de la aplicación, que puede resolverlos con proyecciones sin cargar agregados.</para>
/// </summary>
public interface ITenantRepository : IRepository<Tenant>
{
    Task<Tenant?> GetByIdAsync(TenantId id, CancellationToken cancellationToken = default);

    Task<Tenant?> GetByCodeAsync(Code code, CancellationToken cancellationToken = default);

    /// <summary>¿Existe ya un tenant con este código, en cualquier estado (incluido archivado)?</summary>
    Task<bool> CodeExistsAsync(Code code, CancellationToken cancellationToken = default);

    /// <summary>¿Otro tenant ya usa esta referencia de empresa? <paramref name="excludingTenantId"/> excluye al propio al editar.</summary>
    Task<bool> CompanyReferenceExistsAsync(
        CompanyReference companyReference,
        TenantId? excludingTenantId = null,
        CancellationToken cancellationToken = default);

    Task AddAsync(Tenant tenant, CancellationToken cancellationToken = default);

    /// <summary>
    /// Persiste los cambios con concurrencia optimista sobre <see cref="Tenant.PersistedVersion"/>,
    /// junto con los asientos de <see cref="Tenant.PendingBranchLifecycleEntries"/> en la misma transacción.
    /// </summary>
    Task UpdateAsync(Tenant tenant, CancellationToken cancellationToken = default);
}
