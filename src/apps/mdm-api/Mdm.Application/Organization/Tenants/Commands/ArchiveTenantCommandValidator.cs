namespace Mdm.Application.Organization.Tenants.Commands;

using FluentValidation;
using Mdm.Application.Common.Validation;

internal sealed class ArchiveTenantCommandValidator : AbstractValidator<ArchiveTenantCommand>
{
    public ArchiveTenantCommandValidator()
    {
        RuleFor(c => c.TenantId).MustBeId();
        RuleFor(c => c.ExpectedVersion).MustBeExpectedVersion();
    }
}
