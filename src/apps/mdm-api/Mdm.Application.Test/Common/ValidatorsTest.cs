namespace Mdm.Application.Test.Common;

using FluentValidation;
using Mdm.Application.Common;
using Mdm.Application.Organization.Branches.Commands;
using Mdm.Application.Organization.Branches.Queries;
using Mdm.Application.Organization.DTOs;
using Mdm.Application.Organization.Tenants.Commands;
using Mdm.Application.Organization.Tenants.Queries;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;

public sealed class ValidatorsTest
{
    private static readonly Guid Id = Guid.NewGuid();
    private static readonly string TooLong101 = new('x', 101);
    private static readonly string TooLong201 = new('x', 201);

    private static string? FirstError<T>(IValidator<T> validator, T instance) =>
        validator.Validate(instance).Errors.Select(e => e.ErrorMessage).FirstOrDefault();

    // ---------- CreateTenant ----------
    private static CreateTenantCommand ValidCreate() => new("LIMA", "Organización", "INTERNAL", "20100412447");

    [Fact]
    public void Create_valido_no_tiene_errores() =>
        FirstError(new CreateTenantCommandValidator(), ValidCreate()).Should().BeNull();

    [Fact]
    public void Create_acepta_el_limite_exacto_de_longitud()
    {
        var command = ValidCreate() with { Code = new string('x', Code.MaxLength), Name = new string('x', Name.MaxLength) };

        FirstError(new CreateTenantCommandValidator(), command).Should().BeNull();
    }

    [Theory]
    [MemberData(nameof(InvalidCreates))]
    public void Create_invalido_devuelve_el_codigo_esperado(CreateTenantCommand command, string expected) =>
        FirstError(new CreateTenantCommandValidator(), command).Should().Be(expected);

    public static TheoryData<CreateTenantCommand, string> InvalidCreates() => new()
    {
        { ValidCreate() with { Code = "" }, DomainErrors.Validation.CodeRequired },
        { ValidCreate() with { Code = "  " }, DomainErrors.Validation.CodeRequired },
        { ValidCreate() with { Code = TooLong101 }, DomainErrors.Validation.CodeTooLong },
        { ValidCreate() with { Name = "" }, DomainErrors.Validation.NameRequired },
        { ValidCreate() with { Name = TooLong201 }, DomainErrors.Validation.NameTooLong },
        { ValidCreate() with { Type = "OTRO" }, ApplicationErrors.Validation.OrganizationTypeInvalid },
        { ValidCreate() with { Type = null! }, ApplicationErrors.Validation.OrganizationTypeInvalid },
        { ValidCreate() with { CompanyReference = " " }, DomainErrors.Validation.CompanyReferenceRequired },
        { ValidCreate() with { CompanyReference = TooLong101 }, DomainErrors.Validation.CompanyReferenceTooLong },
        { ValidCreate() with { ParentTenantId = Guid.Empty }, DomainErrors.Validation.IdRequired },
        { ValidCreate() with { Id = Guid.Empty }, DomainErrors.Validation.IdRequired },
    };

    [Theory]
    [InlineData("internal")]
    [InlineData(" Supplier ")]
    [InlineData("CLIENT")]
    public void Create_acepta_tipos_sin_distinguir_mayusculas(string type) =>
        FirstError(new CreateTenantCommandValidator(), ValidCreate() with { Type = type }).Should().BeNull();

    // ---------- UpdateTenant ----------
    private static UpdateTenantCommand ValidUpdate() => new(Id, 1, "Organización", "CLIENT", null);

    [Fact]
    public void Update_valido_no_tiene_errores() =>
        FirstError(new UpdateTenantCommandValidator(), ValidUpdate()).Should().BeNull();

    [Theory]
    [MemberData(nameof(InvalidUpdates))]
    public void Update_invalido_devuelve_el_codigo_esperado(UpdateTenantCommand command, string expected) =>
        FirstError(new UpdateTenantCommandValidator(), command).Should().Be(expected);

    public static TheoryData<UpdateTenantCommand, string> InvalidUpdates() => new()
    {
        { ValidUpdate() with { TenantId = Guid.Empty }, DomainErrors.Validation.IdRequired },
        { ValidUpdate() with { ExpectedVersion = 0 }, ApplicationErrors.Validation.ExpectedVersionInvalid },
        { ValidUpdate() with { Name = "" }, DomainErrors.Validation.NameRequired },
        { ValidUpdate() with { Type = "x" }, ApplicationErrors.Validation.OrganizationTypeInvalid },
        { ValidUpdate() with { CompanyReference = TooLong101 }, DomainErrors.Validation.CompanyReferenceTooLong },
    };

    // ---------- Ciclo de vida del tenant ----------
    [Fact]
    public void Suspend_Activate_Archive_validan_id_y_version()
    {
        FirstError(new SuspendTenantCommandValidator(), new SuspendTenantCommand(Id, 1)).Should().BeNull();
        FirstError(new SuspendTenantCommandValidator(), new SuspendTenantCommand(Guid.Empty, 1)).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(new ActivateTenantCommandValidator(), new ActivateTenantCommand(Id, 0)).Should().Be(ApplicationErrors.Validation.ExpectedVersionInvalid);
        FirstError(new ArchiveTenantCommandValidator(), new ArchiveTenantCommand(Id, -3)).Should().Be(ApplicationErrors.Validation.ExpectedVersionInvalid);
        FirstError(new ArchiveTenantCommandValidator(), new ArchiveTenantCommand(Id, 2)).Should().BeNull();
    }

    // ---------- Sedes ----------
    [Fact]
    public void AddBranch_valida_id_version_codigo_y_nombre()
    {
        var validator = new AddBranchCommandValidator();
        FirstError(validator, new AddBranchCommand(Id, 1, "LIMA", "Lima")).Should().BeNull();
        FirstError(validator, new AddBranchCommand(Guid.Empty, 1, "LIMA", "Lima")).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(validator, new AddBranchCommand(Id, 0, "LIMA", "Lima")).Should().Be(ApplicationErrors.Validation.ExpectedVersionInvalid);
        FirstError(validator, new AddBranchCommand(Id, 1, "", "Lima")).Should().Be(DomainErrors.Validation.CodeRequired);
        FirstError(validator, new AddBranchCommand(Id, 1, TooLong101, "Lima")).Should().Be(DomainErrors.Validation.CodeTooLong);
        FirstError(validator, new AddBranchCommand(Id, 1, "LIMA", "")).Should().Be(DomainErrors.Validation.NameRequired);
        FirstError(validator, new AddBranchCommand(Id, 1, "LIMA", TooLong201)).Should().Be(DomainErrors.Validation.NameTooLong);
    }

    [Fact]
    public void UpdateBranch_valida_ids_version_y_nombre()
    {
        var validator = new UpdateBranchCommandValidator();
        FirstError(validator, new UpdateBranchCommand(Id, Id, 1, "Lima")).Should().BeNull();
        FirstError(validator, new UpdateBranchCommand(Id, Guid.Empty, 1, "Lima")).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(validator, new UpdateBranchCommand(Id, Id, 0, "Lima")).Should().Be(ApplicationErrors.Validation.ExpectedVersionInvalid);
        FirstError(validator, new UpdateBranchCommand(Id, Id, 1, " ")).Should().Be(DomainErrors.Validation.NameRequired);
    }

    [Fact]
    public void Deactivate_Reactivate_Close_validan_ids_version_y_motivo()
    {
        var tooLong = new string('x', 501);
        FirstError(new DeactivateBranchCommandValidator(), new DeactivateBranchCommand(Id, Id, 1)).Should().BeNull();
        FirstError(new DeactivateBranchCommandValidator(), new DeactivateBranchCommand(Id, Id, 1, tooLong)).Should().Be(DomainErrors.Validation.ReasonTooLong);
        FirstError(new ReactivateBranchCommandValidator(), new ReactivateBranchCommand(Guid.Empty, Id, 1)).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(new ReactivateBranchCommandValidator(), new ReactivateBranchCommand(Id, Id, 0)).Should().Be(ApplicationErrors.Validation.ExpectedVersionInvalid);
        FirstError(new CloseBranchCommandValidator(), new CloseBranchCommand(Id, Guid.Empty, 1)).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(new CloseBranchCommandValidator(), new CloseBranchCommand(Id, Id, 1, new string('x', 500))).Should().BeNull();
        FirstError(new CloseBranchCommandValidator(), new CloseBranchCommand(Id, Id, 1, tooLong)).Should().Be(DomainErrors.Validation.ReasonTooLong);
    }

    // ---------- Consultas ----------
    [Fact]
    public void ListTenants_por_defecto_es_valido() =>
        FirstError(new ListTenantsQueryValidator(), new ListTenantsQuery()).Should().BeNull();

    [Theory]
    [InlineData(1, 1)]
    [InlineData(1, 100)]
    [InlineData(50, 20)]
    public void ListTenants_acepta_limites_de_paginacion(int page, int pageSize) =>
        FirstError(new ListTenantsQueryValidator(), new ListTenantsQuery(page, pageSize)).Should().BeNull();

    [Theory]
    [MemberData(nameof(InvalidListings))]
    public void ListTenants_invalido_devuelve_el_codigo_esperado(ListTenantsQuery query, string expected) =>
        FirstError(new ListTenantsQueryValidator(), query).Should().Be(expected);

    public static TheoryData<ListTenantsQuery, string> InvalidListings() => new()
    {
        { new ListTenantsQuery(Page: 0), ApplicationErrors.Validation.PageInvalid },
        { new ListTenantsQuery(Page: -1), ApplicationErrors.Validation.PageInvalid },
        { new ListTenantsQuery(PageSize: 0), ApplicationErrors.Validation.PageSizeInvalid },
        { new ListTenantsQuery(PageSize: 101), ApplicationErrors.Validation.PageSizeInvalid },
        { new ListTenantsQuery(SortBy: "id"), ApplicationErrors.Validation.SortByInvalid },
        { new ListTenantsQuery(SortBy: null!), ApplicationErrors.Validation.SortByInvalid },
        { new ListTenantsQuery(SortOrder: "up"), ApplicationErrors.Validation.SortOrderInvalid },
        { new ListTenantsQuery(SortOrder: null!), ApplicationErrors.Validation.SortOrderInvalid },
        { new ListTenantsQuery(Status: "Deleted"), ApplicationErrors.Validation.StatusInvalid },
        { new ListTenantsQuery(Search: new string('x', 201)), ApplicationErrors.Validation.SearchTooLong },
    };

    [Theory]
    [InlineData("code", "asc")]
    [InlineData("NAME", "DESC")]
    [InlineData(" name ", " desc ")]
    [InlineData("createdAt", "asc")]
    [InlineData("CREATEDAT", "desc")]
    public void ListTenants_acepta_orden_sin_distinguir_mayusculas(string sortBy, string sortOrder) =>
        FirstError(new ListTenantsQueryValidator(), new ListTenantsQuery(SortBy: sortBy, SortOrder: sortOrder)).Should().BeNull();

    [Theory]
    [InlineData("active")]
    [InlineData("SUSPENDED")]
    [InlineData("")]
    [InlineData(null)]
    public void ListTenants_acepta_estados_validos_o_ausente(string? status) =>
        FirstError(new ListTenantsQueryValidator(), new ListTenantsQuery(Status: status)).Should().BeNull();

    [Fact]
    public void Consultas_por_id_rechazan_guid_vacio()
    {
        FirstError(new GetTenantQueryValidator(), new GetTenantQuery(Id)).Should().BeNull();
        FirstError(new GetTenantQueryValidator(), new GetTenantQuery(Guid.Empty)).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(new GetBranchQueryValidator(), new GetBranchQuery(Id, Id)).Should().BeNull();
        FirstError(new GetBranchQueryValidator(), new GetBranchQuery(Id, Guid.Empty)).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(new ListBranchesQueryValidator(), new ListBranchesQuery(Guid.Empty)).Should().Be(DomainErrors.Validation.IdRequired);
        FirstError(new ListBranchesQueryValidator(), new ListBranchesQuery(Id, (BranchStatusFilter)99)).Should().Be(ApplicationErrors.Validation.StatusInvalid);
        FirstError(new ListBranchesQueryValidator(), new ListBranchesQuery(Id, BranchStatusFilter.Closed)).Should().BeNull();
    }
}
