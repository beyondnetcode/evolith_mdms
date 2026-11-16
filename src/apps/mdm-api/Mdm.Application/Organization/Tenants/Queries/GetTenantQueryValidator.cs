namespace Mdm.Application.Organization.Tenants.Queries;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class GetTenantQueryValidator : AbstractValidator<GetTenantQuery>
{
    public GetTenantQueryValidator()
    {
        RuleFor(q => q.Id).MustBeId();
    }
}
