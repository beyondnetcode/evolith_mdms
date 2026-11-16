namespace Mdm.Application.Test.Support;

using Moq;
using Mdm.Application.Common;
using Mdm.Application.Common.Exceptions;
using Mdm.Domain.Kernel;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

/// <summary>
/// Escenarios comunes a todo comando que modifica un tenant: éxito con versión nueva, sin usuario,
/// no encontrado, versión desfasada, conflicto de persistencia y error de dominio. Cada handler
/// concreto hereda los hechos y aporta solo su comando y sus estados de partida.
/// </summary>
public abstract class MutationHandlerTestBase<TCommand> : HandlerFixture
{
    /// <summary>Tenant en un estado donde la operación tiene éxito.</summary>
    protected abstract TenantAggregate ReadyTenant();

    /// <summary>Tenant en un estado donde la operación falla, con el código esperado.</summary>
    protected abstract (TenantAggregate Tenant, string Error) FailingTenant();

    protected abstract TCommand CommandFor(TenantAggregate tenant, long expectedVersion);

    protected abstract Task<Result<long>> SendAsync(TCommand command);

    [Fact]
    public async Task Exito_devuelve_la_nueva_version_y_persiste_una_vez()
    {
        var tenant = ReadyTenant();
        var before = tenant.Version;
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, before));

        result.IsSuccess.Should().BeTrue(result.Error);
        result.Value.Should().Be(before + 1).And.Be(tenant.Version);
        Tenants.Verify(r => r.UpdateAsync(tenant, It.IsAny<CancellationToken>()), Times.Once);
        UnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Sin_usuario_falla_con_auth_user_required(string? actor)
    {
        CurrentUser.SetupGet(u => u.ActorId).Returns(actor);
        var tenant = ReadyTenant();
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, tenant.Version));

        result.Error.Should().Be(ApplicationErrors.UserRequired);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Tenant_inexistente_falla_con_tenant_not_found()
    {
        var tenant = ReadyTenant();
        Returns(null);

        var result = await SendAsync(CommandFor(tenant, tenant.Version));

        result.Error.Should().Be(DomainErrors.Tenant.NotFound);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Version_desfasada_falla_con_version_mismatch_sin_mutar()
    {
        var tenant = ReadyTenant();
        var before = tenant.Version;
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, before + 5));

        result.Error.Should().Be(ApplicationErrors.VersionMismatch);
        tenant.Version.Should().Be(before);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Conflicto_de_persistencia_se_traduce_a_version_mismatch()
    {
        var tenant = ReadyTenant();
        Returns(tenant);
        SaveThrows(new ConcurrencyConflictException());

        var result = await SendAsync(CommandFor(tenant, tenant.Version));

        result.Error.Should().Be(ApplicationErrors.VersionMismatch);
    }

    [Fact]
    public async Task Error_de_dominio_se_devuelve_con_su_codigo_sin_persistir()
    {
        var (tenant, error) = FailingTenant();
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, tenant.Version));

        result.Error.Should().Be(error);
        VerifyNothingPersisted();
    }
}
