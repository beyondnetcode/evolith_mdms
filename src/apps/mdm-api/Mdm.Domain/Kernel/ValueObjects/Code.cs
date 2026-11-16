namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>
/// Código de negocio de un maestro (tenant, sede). Se normaliza al crearse
/// (<see cref="DomainGuards.NormalizeCode"/>), de modo que «lima 01» y «LIMA_01» son el mismo código.
/// </summary>
public sealed class Code : StringValueObject
{
    /// <summary>Longitud máxima; coincide con la columna de UMS para importar sin truncar.</summary>
    public const int MaxLength = 100;

    private static readonly TextRule Rule = new(
        nameof(Code), MaxLength, DomainErrors.Validation.CodeRequired, DomainErrors.Validation.CodeTooLong);

    private Code(string value) : base(value)
    {
    }

    public static Code Create(string? value) => new(DomainGuards.NormalizeCode(value));

    public override void AddValidators()
    {
        base.AddValidators();
        ValidatorRules.Add(new TextRuleValidator(this, Rule));
    }
}
