namespace Mdm.Application.Organization.Tenants.Commands;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class UpdateTenantCommandValidator : AbstractValidator<UpdateTenantCommand>
{
    public UpdateTenantCommandValidator()
    {
        RuleFor(c => c.TenantId).MustBeId();
        RuleFor(c => c.ExpectedVersion).MustBeExpectedVersion();
        RuleFor(c => c.Name).MustBeName();
        RuleFor(c => c.Type).MustBeOrganizationType();
        RuleFor(c => c.CompanyReference).MustBeOptionalCompanyReference();
    }
}
