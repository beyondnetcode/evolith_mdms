namespace Mdm.Application.Organization.Tenants.Commands;

using FluentValidation;
using Mdm.Application.Common.Validation;
using Mdm.Domain.Kernel;

internal sealed class CreateTenantCommandValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantCommandValidator()
    {
        RuleFor(c => c.Code).MustBeCode();
        RuleFor(c => c.Name).MustBeName();
        RuleFor(c => c.Type).MustBeOrganizationType();
        RuleFor(c => c.CompanyReference).MustBeOptionalCompanyReference();
        RuleFor(c => c.ParentTenantId).Must(v => v is null || v != Guid.Empty).WithMessage(DomainErrors.Validation.IdRequired);
        RuleFor(c => c.Id).Must(v => v is null || v != Guid.Empty).WithMessage(DomainErrors.Validation.IdRequired);
    }
}
