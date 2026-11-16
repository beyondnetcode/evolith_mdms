namespace Mdm.Application.Organization.Branches.Commands;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class CloseBranchCommandValidator : AbstractValidator<CloseBranchCommand>
{
    public CloseBranchCommandValidator()
    {
        RuleFor(c => c.TenantId).MustBeId();
        RuleFor(c => c.BranchId).MustBeId();
        RuleFor(c => c.ExpectedVersion).MustBeExpectedVersion();
        RuleFor(c => c.Reason).MustBeOptionalReason();
    }
}
