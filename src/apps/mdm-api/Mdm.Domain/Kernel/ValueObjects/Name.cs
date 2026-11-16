namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>Nombre legible de un maestro; se recorta, no se normaliza.</summary>
public sealed class Name : StringValueObject
{
    public const int MaxLength = 200;

    private static readonly TextRule Rule = new(
        nameof(Name), MaxLength, DomainErrors.Validation.NameRequired, DomainErrors.Validation.NameTooLong);

    private Name(string value) : base(value)
    {
    }

    public static Name Create(string? value) => new(value?.Trim() ?? string.Empty);

    public override void AddValidators()
    {
        base.AddValidators();
        ValidatorRules.Add(new TextRuleValidator(this, Rule));
    }
}
