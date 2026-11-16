using FluentAssertions;
using Mdm.Application.Common;
using Mdm.Domain.Kernel;
using Mdm.Presentation.Http;

namespace Mdm.Presentation.IntegrationTest.Organization;

/// <summary>Tabla código de error → estado HTTP y <c>code</c> público (contrato §4 y §5).</summary>
public sealed class ErrorMappingTest
{
    public static TheoryData<string, int, string> Table => new()
    {
        { DomainErrors.Validation.NameRequired, 400, "validation.failed" },
        { ApplicationErrors.Validation.PageSizeInvalid, 400, "validation.failed" },
        { ApplicationErrors.Validation.ExpectedVersionInvalid, 400, "validation.failed" },
        { DomainErrors.Tenant.OrganizationTypeRequired, 400, "validation.failed" },
        { DomainErrors.Tenant.ParentInvalid, 400, "tenant.parent_not_found" },
        { ApplicationErrors.UserRequired, 401, "auth.user_required" },
        { DomainErrors.Tenant.NotFound, 404, "common.not_found" },
        { DomainErrors.Tenant.BranchNotFound, 404, "common.not_found" },
        { DomainErrors.Tenant.CodeNotUnique, 409, "tenant.code_not_unique" },
        { DomainErrors.Tenant.BranchCodeNotUnique, 409, "branch.code_not_unique" },
        { DomainErrors.Tenant.ParentArchived, 409, "tenant.parent_archived" },
        { DomainErrors.Tenant.Archived, 409, "tenant.archived" },
        { DomainErrors.Tenant.NotActive, 409, "tenant.not_active" },
        { DomainErrors.Tenant.HasActiveBranches, 409, "tenant.has_active_branches" },
        { DomainErrors.Tenant.BranchClosed, 409, "branch.closed" },
        { DomainErrors.Tenant.AlreadyActive, 409, "tenant.already_active" },
        { DomainErrors.Tenant.AlreadySuspended, 409, "tenant.already_suspended" },
        { DomainErrors.Tenant.BranchAlreadyActive, 409, "branch.already_active" },
        { DomainErrors.Tenant.BranchAlreadyInactive, 409, "branch.already_inactive" },
        { ApplicationErrors.VersionMismatch, 412, "precondition.failed" },
        { DomainErrorStatusMapper.PreconditionRequired, 428, "precondition.required" },
    };

    [Theory]
    [MemberData(nameof(Table))]
    public void Cada_codigo_se_publica_con_su_estado_y_su_code(string error, int status, string code)
    {
        var found = DomainErrorStatusMapper.TryMap(error, out var spec);

        found.Should().BeTrue();
        spec.Status.Should().Be(status);
        spec.Code.Should().Be(code);
        spec.Title.Should().NotBeNullOrWhiteSpace();
        spec.Detail.Should().NotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData("tenant.algo_nuevo")]
    [InlineData("algo.not_found")]
    [InlineData("")]
    public void Un_codigo_desconocido_no_se_adivina_por_subcadenas(string error)
    {
        DomainErrorStatusMapper.TryMap(error, out _).Should().BeFalse();
    }

    [Theory]
    [InlineData("validation.name_required", "name")]
    [InlineData("validation.page_size_invalid", "pageSize")]
    [InlineData("validation.regla_futura", "request")]
    public void El_campo_de_validacion_sale_de_una_tabla(string error, string field)
    {
        DomainErrorStatusMapper.FieldOf(error).Should().Be(field);
    }
}
