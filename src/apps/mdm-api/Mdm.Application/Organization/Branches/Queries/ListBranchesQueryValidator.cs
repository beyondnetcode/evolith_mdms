namespace Mdm.Application.Organization.Branches.Queries;

using FluentValidation;
using Mdm.Application.Common;
using Mdm.Application.Common.Validation;

internal sealed class ListBranchesQueryValidator : AbstractValidator<ListBranchesQuery>
{
    public ListBranchesQueryValidator()
    {
        RuleFor(q => q.TenantId).MustBeId();
        RuleFor(q => q.Status).IsInEnum().WithMessage(ApplicationErrors.Validation.StatusInvalid);
    }
}
