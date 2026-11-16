namespace Mdm.Application.Organization.Tenants.Queries;

using FluentValidation;
using Mdm.Application.Common;
using Mdm.Application.Common.Validation;

internal sealed class ListTenantsQueryValidator : AbstractValidator<ListTenantsQuery>
{
    public const int MaxPageSize = 100;
    public const int SearchMaxLength = 200;

    private static readonly string[] SortFields = ["code", "name", "createdat"];
    private static readonly string[] SortOrders = ["asc", "desc"];

    public ListTenantsQueryValidator()
    {
        RuleFor(q => q.Page).GreaterThanOrEqualTo(1).WithMessage(ApplicationErrors.Validation.PageInvalid);
        RuleFor(q => q.PageSize).InclusiveBetween(1, MaxPageSize).WithMessage(ApplicationErrors.Validation.PageSizeInvalid);
        RuleFor(q => q.SortBy)
            .Must(v => v is not null && SortFields.Contains(v.Trim(), StringComparer.OrdinalIgnoreCase))
            .WithMessage(ApplicationErrors.Validation.SortByInvalid);
        RuleFor(q => q.SortOrder)
            .Must(v => v is not null && SortOrders.Contains(v.Trim(), StringComparer.OrdinalIgnoreCase))
            .WithMessage(ApplicationErrors.Validation.SortOrderInvalid);
        RuleFor(q => q.Status)
            .Must(v => string.IsNullOrWhiteSpace(v) || TenantStatuses.TryNormalize(v, out _))
            .WithMessage(ApplicationErrors.Validation.StatusInvalid);
        RuleFor(q => q.Search)
            .Must(v => v is null || v.Trim().Length <= SearchMaxLength)
            .WithMessage(ApplicationErrors.Validation.SearchTooLong);
    }
}
