namespace Mdm.Application.Test.Tenants;

using Moq;
using Mdm.Application.Common;
using Mdm.Application.Organization.Tenants.Commands;
using Mdm.Application.Test.Support;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

public sealed class UpdateTenantHandlerTest : MutationHandlerTestBase<UpdateTenantCommand>
{
    protected override TenantAggregate ReadyTenant() => TenantMother.Active();

    protected override (TenantAggregate Tenant, string Error) FailingTenant() =>
        (TenantMother.Archived(), DomainErrors.Tenant.Archived);

    protected override UpdateTenantCommand CommandFor(TenantAggregate tenant, long expectedVersion) =>
        new(tenant.TenantId.GetValue(), expectedVersion, "Nuevo nombre", "client", "20999999999");

    protected override Task<Result<long>> SendAsync(UpdateTenantCommand command) =>
        new UpdateTenantCommandHandler(Executor, Tenants.Object).Handle(command, CancellationToken.None);

    [Fact]
    public async Task Exito_aplica_nombre_tipo_y_referencia()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);

        var result = await SendAsync(CommandFor(tenant, tenant.Version));

        result.IsSuccess.Should().BeTrue(result.Error);
        tenant.Name.GetValue().Should().Be("Nuevo nombre");
        tenant.Type.Name.Should().Be("CLIENT");
        tenant.CompanyReference!.GetValue().Should().Be("20999999999");
    }

    [Fact]
    public async Task Referencia_de_empresa_ya_usada_por_otro_falla_sin_mutar()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);
        Tenants.Setup(r => r.CompanyReferenceExistsAsync(It.IsAny<CompanyReference>(), tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await SendAsync(CommandFor(tenant, tenant.Version));

        result.Error.Should().Be(DomainErrors.Tenant.CompanyReferenceNotUnique);
        tenant.Name.GetValue().Should().Be("Organización S.A.");
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Tipo_desconocido_falla_con_organization_type_invalid()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);
        var command = CommandFor(tenant, tenant.Version) with { Type = "OTRO" };

        var result = await SendAsync(command);

        result.Error.Should().Be(ApplicationErrors.Validation.OrganizationTypeInvalid);
    }

    [Fact]
    public async Task Sin_referencia_no_consulta_unicidad()
    {
        var tenant = TenantMother.Active();
        Returns(tenant);
        var command = CommandFor(tenant, tenant.Version) with { CompanyReference = null };

        var result = await SendAsync(command);

        result.IsSuccess.Should().BeTrue(result.Error);
        tenant.CompanyReference.Should().BeNull();
        Tenants.Verify(
            r => r.CompanyReferenceExistsAsync(It.IsAny<CompanyReference>(), It.IsAny<TenantId?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
