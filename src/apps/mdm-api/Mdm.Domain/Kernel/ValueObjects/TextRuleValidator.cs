namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>Regla de forma de un texto: obligatorio y con longitud máxima, con su código para cada fallo.</summary>
public sealed record TextRule(string PropertyName, int MaxLength, string RequiredCode, string TooLongCode);

/// <summary>
/// Aplica una <see cref="TextRule"/> a un objeto de valor de texto. Un único validador por objeto
/// de valor, porque la shell descarta un segundo validador del mismo tipo.
/// </summary>
public sealed class TextRuleValidator : AbstractRuleValidator<ValueObject<string>>
{
    private readonly TextRule _rule;

    public TextRuleValidator(ValueObject<string> subject, TextRule rule) : base(subject)
    {
        _rule = rule;
    }

    public override void AddRules(RuleContext? context)
    {
        var value = Subject.GetValue();
        if (string.IsNullOrWhiteSpace(value))
        {
            AddBrokenRule(_rule.PropertyName, _rule.RequiredCode);
        }
        else if (value.Length > _rule.MaxLength)
        {
            AddBrokenRule(_rule.PropertyName, _rule.TooLongCode);
        }
    }
}
