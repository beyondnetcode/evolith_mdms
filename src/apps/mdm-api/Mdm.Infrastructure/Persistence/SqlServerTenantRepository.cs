using Microsoft.EntityFrameworkCore;
using Mdm.Application.Common.Exceptions;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using Mdm.Infrastructure.Persistence.Records;
using AppUnitOfWork = Mdm.Application.Organization.Abstractions.IUnitOfWork;
using ShellsUnitOfWork = Unimar.Shells.Net.Ddd.Interfaces.IUnitOfWork;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

namespace Mdm.Infrastructure.Persistence;

/// <summary>
/// Repositorio del agregado <c>Tenant</c> sobre SQL Server y, a la vez, su unidad de trabajo.
///
/// <para><b>Un solo objeto por alcance.</b> El repositorio anota qué agregados escribió y la unidad
/// de trabajo, al confirmar, les llama <c>MarkAsPersisted</c>: por eso son la misma instancia y se
/// registran juntas.</para>
///
/// <para><b>Lectura rastreada, escritura por diferencias.</b> <c>GetByIdAsync</c> carga la fila con
/// sus sedes rastreadas; <c>UpdateAsync</c> vuelca el agregado sobre esa fila y EF emite solo lo que
/// cambió. La versión esperada del <c>UPDATE</c> es <c>Tenant.PersistedVersion</c>, no la leída en el
/// momento de guardar: así una fila que otro proceso avanzó entre la lectura y el guardado produce
/// cero filas afectadas y no se pisa en silencio.</para>
/// </summary>
public sealed class SqlServerTenantRepository(MdmDbContext dbContext)
    : ITenantRepository, AppUnitOfWork, ShellsUnitOfWork
{
    private readonly List<TenantAggregate> _written = [];

    public ShellsUnitOfWork UnitOfWork => this;

    public async Task<TenantAggregate?> GetByIdAsync(TenantId id, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(id);
        var guid = id.GetValue();
        var record = await dbContext.Tenants
            .Include(t => t.Branches)
            .AsSingleQuery()
            .FirstOrDefaultAsync(t => t.Id == guid, cancellationToken)
            .ConfigureAwait(false);
        return record is null ? null : Rehydrate(record);
    }

    public async Task<TenantAggregate?> GetByCodeAsync(Code code, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(code);
        var value = code.GetValue();
        var record = await dbContext.Tenants
            .Include(t => t.Branches)
            .AsSingleQuery()
            .FirstOrDefaultAsync(t => t.Code == value, cancellationToken)
            .ConfigureAwait(false);
        return record is null ? null : Rehydrate(record);
    }

    /// <inheritdoc/>
    /// <remarks>Sin filtro por estado: el código de una organización archivada sigue ocupado (MDM-001 D5).</remarks>
    public Task<bool> CodeExistsAsync(Code code, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(code);
        var value = code.GetValue();
        return dbContext.Tenants.AsNoTracking().AnyAsync(t => t.Code == value, cancellationToken);
    }

    public Task<bool> CompanyReferenceExistsAsync(
        CompanyReference companyReference,
        TenantId? excludingTenantId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(companyReference);
        var value = companyReference.GetValue();
        var excluded = excludingTenantId?.GetValue();
        return dbContext.Tenants.AsNoTracking()
            .AnyAsync(t => t.CompanyReference == value && (excluded == null || t.Id != excluded), cancellationToken);
    }

    public Task AddAsync(TenantAggregate tenant, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(tenant);
        cancellationToken.ThrowIfCancellationRequested();
        dbContext.Tenants.Add(TenantRecordMapper.ToRecord(tenant));
        StageLifecycleEntries(tenant);
        _written.Add(tenant);
        return Task.CompletedTask;
    }

    public async Task UpdateAsync(TenantAggregate tenant, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(tenant);
        var guid = tenant.TenantId.GetValue();
        var record = dbContext.Tenants.Local.FirstOrDefault(t => t.Id == guid)
            ?? await dbContext.Tenants
                .Include(t => t.Branches)
                .AsSingleQuery()
                .FirstOrDefaultAsync(t => t.Id == guid, cancellationToken)
                .ConfigureAwait(false)
            ?? throw new ConcurrencyConflictException("La organización ya no existe en el maestro.");

        var addedBranches = TenantRecordMapper.ApplyTo(tenant, record);

        // WHERE Version = PersistedVersion: la versión con la que se leyó el agregado, no la de la fila.
        dbContext.Entry(record).Property(t => t.Version).OriginalValue = tenant.PersistedVersion;

        // Con Id asignado por la aplicación EF trataría una entidad descubierta como existente
        // (UPDATE): las sedes nuevas se registran como Added de forma explícita.
        dbContext.TenantBranches.AddRange(addedBranches);
        StageLifecycleEntries(tenant);
        _written.Add(tenant);
    }

    /// <summary>Contrato de la aplicación: traduce los fallos del motor a excepciones propias.</summary>
    Task AppUnitOfWork.SaveChangesAsync(CancellationToken ct) => SaveChangesAsync(ct);

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        int affected;
        try
        {
            affected = await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new ConcurrencyConflictException("La versión persistida del agregado no coincide con la esperada.", ex);
        }
        catch (DbUpdateException ex) when (SqlServerErrors.TryGetUniqueViolation(ex, out var constraint))
        {
            throw new DuplicateKeyConflictException(constraint, ex);
        }

        foreach (var tenant in _written)
        {
            tenant.MarkAsPersisted();
        }

        _written.Clear();
        return affected;
    }

    public async Task<bool> SaveEntitiesAsync(object entity, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entity);
        return await SaveChangesAsync(cancellationToken).ConfigureAwait(false) > 0;
    }

    /// <summary>El <c>DbContext</c> es del contenedor de DI, no de esta clase: no se libera aquí.</summary>
    public void Dispose()
    {
    }

    private static TenantAggregate Rehydrate(TenantRecord record) =>
        TenantAggregate.Load(TenantRecordMapper.ToSnapshot(record));

    private void StageLifecycleEntries(TenantAggregate tenant) =>
        dbContext.BranchLifecycleEntries.AddRange(
            tenant.PendingBranchLifecycleEntries.Select(TenantRecordMapper.ToEntryRecord));
}
