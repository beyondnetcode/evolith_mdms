namespace Mdm.Application.Organization.Branches.Queries;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class GetBranchQueryValidator : AbstractValidator<GetBranchQuery>
{
    public GetBranchQueryValidator()
    {
        RuleFor(q => q.TenantId).MustBeId();
        RuleFor(q => q.BranchId).MustBeId();
    }
}
