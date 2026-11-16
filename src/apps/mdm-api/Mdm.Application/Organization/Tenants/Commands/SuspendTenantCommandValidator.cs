namespace Mdm.Application.Organization.Tenants.Commands;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class SuspendTenantCommandValidator : AbstractValidator<SuspendTenantCommand>
{
    public SuspendTenantCommandValidator()
    {
        RuleFor(c => c.TenantId).MustBeId();
        RuleFor(c => c.ExpectedVersion).MustBeExpectedVersion();
    }
}
