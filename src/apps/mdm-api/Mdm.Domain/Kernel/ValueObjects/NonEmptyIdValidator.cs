namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>Un identificador no puede ser <see cref="Guid.Empty"/>: no identifica a nadie.</summary>
public sealed class NonEmptyIdValidator : AbstractRuleValidator<ValueObject<Guid>>
{
    private readonly string _propertyName;

    public NonEmptyIdValidator(ValueObject<Guid> subject, string propertyName) : base(subject)
    {
        _propertyName = propertyName;
    }

    public override void AddRules(RuleContext? context)
    {
        if (Subject.GetValue() == Guid.Empty)
        {
            AddBrokenRule(_propertyName, DomainErrors.Validation.IdRequired);
        }
    }
}
