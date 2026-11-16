namespace Mdm.Application.Organization.Branches.Commands;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class AddBranchCommandValidator : AbstractValidator<AddBranchCommand>
{
    public AddBranchCommandValidator()
    {
        RuleFor(c => c.TenantId).MustBeId();
        RuleFor(c => c.ExpectedVersion).MustBeExpectedVersion();
        RuleFor(c => c.Code).MustBeCode();
        RuleFor(c => c.Name).MustBeName();
    }
}
