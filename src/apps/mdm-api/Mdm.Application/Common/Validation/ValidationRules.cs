namespace Mdm.Application.Common.Validation;

using FluentValidation;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant.Branch;

/// <summary>
/// Reglas de forma compartidas por los validadores. El mensaje de cada regla es el código estable
/// del error (<see cref="DomainErrors.Validation"/> o <see cref="ApplicationErrors.Validation"/>),
/// con los mismos límites de longitud que el dominio.
/// </summary>
internal static class ValidationRules
{
    public static IRuleBuilderOptions<T, string> MustBeCode<T>(this IRuleBuilder<T, string> rule) => rule
        .NotEmpty().WithMessage(DomainErrors.Validation.CodeRequired)
        .MaximumLength(Code.MaxLength).WithMessage(DomainErrors.Validation.CodeTooLong);

    public static IRuleBuilderOptions<T, string> MustBeName<T>(this IRuleBuilder<T, string> rule) => rule
        .NotEmpty().WithMessage(DomainErrors.Validation.NameRequired)
        .MaximumLength(Name.MaxLength).WithMessage(DomainErrors.Validation.NameTooLong);

    public static IRuleBuilderOptions<T, string?> MustBeOptionalCompanyReference<T>(this IRuleBuilder<T, string?> rule) => rule
        .Must(v => v is null || !string.IsNullOrWhiteSpace(v)).WithMessage(DomainErrors.Validation.CompanyReferenceRequired)
        .Must(v => v is null || v.Trim().Length <= CompanyReference.MaxLength).WithMessage(DomainErrors.Validation.CompanyReferenceTooLong);

    public static IRuleBuilderOptions<T, string?> MustBeOptionalReason<T>(this IRuleBuilder<T, string?> rule) => rule
        .Must(v => v is null || v.Trim().Length <= BranchLifecycleEntry.ReasonMaxLength)
        .WithMessage(DomainErrors.Validation.ReasonTooLong);

    public static IRuleBuilderOptions<T, string> MustBeOrganizationType<T>(this IRuleBuilder<T, string> rule) => rule
        .Must(v => OrganizationTypes.TryParse(v, out _)).WithMessage(ApplicationErrors.Validation.OrganizationTypeInvalid);

    public static IRuleBuilderOptions<T, Guid> MustBeId<T>(this IRuleBuilder<T, Guid> rule) => rule
        .NotEmpty().WithMessage(DomainErrors.Validation.IdRequired);

    public static IRuleBuilderOptions<T, long> MustBeExpectedVersion<T>(this IRuleBuilder<T, long> rule) => rule
        .GreaterThan(0).WithMessage(ApplicationErrors.Validation.ExpectedVersionInvalid);
}
