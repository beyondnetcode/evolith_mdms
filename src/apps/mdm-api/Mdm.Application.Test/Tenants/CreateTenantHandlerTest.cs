namespace Mdm.Application.Test.Tenants;

using Moq;
using Mdm.Application.Common;
using Mdm.Application.Common.Exceptions;
using Mdm.Application.Organization.Tenants.Commands;
using Mdm.Application.Test.Support;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

public sealed class CreateTenantHandlerTest : HandlerFixture
{
    private static CreateTenantCommand Valid() => new("lima 01", "Organización S.A.", "internal", "20100412447");

    private Task<Result<CreateTenantResult>> SendAsync(CreateTenantCommand command) =>
        new CreateTenantCommandHandler(Tenants.Object, UnitOfWork.Object, CurrentUser.Object).Handle(command, CancellationToken.None);

    [Fact]
    public async Task Exito_devuelve_id_y_version_1_y_persiste_el_alta()
    {
        TenantAggregate? added = null;
        Tenants.Setup(r => r.AddAsync(It.IsAny<TenantAggregate>(), It.IsAny<CancellationToken>()))
            .Callback<TenantAggregate, CancellationToken>((t, _) => added = t)
            .Returns(Task.CompletedTask);

        var result = await SendAsync(Valid());

        result.IsSuccess.Should().BeTrue(result.Error);
        result.Value.Version.Should().Be(1);
        result.Value.Id.Should().Be(added!.TenantId.GetValue());
        added.Code.GetValue().Should().Be("LIMA_01");
        added.Audit.GetValue().CreatedBy.Should().Be(TenantMother.ActorName);
        UnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Respeta_el_id_y_el_padre_informados()
    {
        var id = Guid.NewGuid();
        var parentId = Guid.NewGuid();
        Tenants.Setup(r => r.GetByIdAsync(It.Is<TenantId>(t => t.GetValue() == parentId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(TenantMother.Active("MATRIZ"));

        var result = await SendAsync(Valid() with { Id = id, ParentTenantId = parentId });

        result.IsSuccess.Should().BeTrue(result.Error);
        result.Value.Id.Should().Be(id);
    }

    [Fact]
    public async Task Padre_inexistente_falla_con_parent_invalid()
    {
        var result = await SendAsync(Valid() with { ParentTenantId = Guid.NewGuid() });

        result.Error.Should().Be(DomainErrors.Tenant.ParentInvalid);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Padre_archivado_falla_con_parent_archived()
    {
        var parentId = Guid.NewGuid();
        Tenants.Setup(r => r.GetByIdAsync(It.Is<TenantId>(t => t.GetValue() == parentId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(TenantMother.Archived());

        var result = await SendAsync(Valid() with { ParentTenantId = parentId });

        result.Error.Should().Be(DomainErrors.Tenant.ParentArchived);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Sin_usuario_falla_con_auth_user_required()
    {
        CurrentUser.SetupGet(u => u.ActorId).Returns((string?)null);

        var result = await SendAsync(Valid());

        result.Error.Should().Be(ApplicationErrors.UserRequired);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Tipo_desconocido_falla_con_organization_type_invalid()
    {
        var result = await SendAsync(Valid() with { Type = "OTRO" });

        result.Error.Should().Be(ApplicationErrors.Validation.OrganizationTypeInvalid);
    }

    [Fact]
    public async Task Error_de_dominio_se_devuelve_sin_consultar_ni_persistir()
    {
        var result = await SendAsync(Valid() with { Code = "  " });

        result.Error.Should().Be(DomainErrors.Validation.CodeRequired);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Codigo_existente_falla_con_code_not_unique()
    {
        Tenants.Setup(r => r.CodeExistsAsync(It.IsAny<Code>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await SendAsync(Valid());

        result.Error.Should().Be(DomainErrors.Tenant.CodeNotUnique);
        VerifyNothingPersisted();
    }

    [Fact]
    public async Task Referencia_de_empresa_existente_falla_con_company_reference_not_unique()
    {
        Tenants.Setup(r => r.CompanyReferenceExistsAsync(It.IsAny<CompanyReference>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await SendAsync(Valid());

        result.Error.Should().Be(DomainErrors.Tenant.CompanyReferenceNotUnique);
        VerifyNothingPersisted();
    }

    [Theory]
    [InlineData(DuplicateKeyConflictException.TenantCode, DomainErrors.Tenant.CodeNotUnique)]
    [InlineData(DuplicateKeyConflictException.TenantCompanyReference, DomainErrors.Tenant.CompanyReferenceNotUnique)]
    public async Task Carrera_de_unicidad_en_el_guardado_se_traduce_por_indice(string constraint, string expected)
    {
        SaveThrows(new DuplicateKeyConflictException(constraint));

        var result = await SendAsync(Valid());

        result.Error.Should().Be(expected);
    }

    [Fact]
    public async Task Indice_desconocido_no_se_oculta()
    {
        SaveThrows(new DuplicateKeyConflictException("UX_Otro"));

        var act = () => SendAsync(Valid());

        (await act.Should().ThrowAsync<DuplicateKeyConflictException>()).Which.Constraint.Should().Be("UX_Otro");
    }
}
