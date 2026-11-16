namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>Quién ejecuta la operación (el sujeto autenticado), para auditoría y bitácora.</summary>
public sealed class ActorId : StringValueObject
{
    public const int MaxLength = 100;

    private static readonly TextRule Rule = new(
        nameof(ActorId), MaxLength, DomainErrors.Validation.ActorRequired, DomainErrors.Validation.ActorTooLong);

    private ActorId(string value) : base(value)
    {
    }

    public static ActorId Create(string? value) => new(value?.Trim() ?? string.Empty);

    public override void AddValidators()
    {
        base.AddValidators();
        ValidatorRules.Add(new TextRuleValidator(this, Rule));
    }
}
