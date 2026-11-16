namespace Mdm.Application.Organization.Branches.Commands;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class UpdateBranchCommandValidator : AbstractValidator<UpdateBranchCommand>
{
    public UpdateBranchCommandValidator()
    {
        RuleFor(c => c.TenantId).MustBeId();
        RuleFor(c => c.BranchId).MustBeId();
        RuleFor(c => c.ExpectedVersion).MustBeExpectedVersion();
        RuleFor(c => c.Name).MustBeName();
    }
}
