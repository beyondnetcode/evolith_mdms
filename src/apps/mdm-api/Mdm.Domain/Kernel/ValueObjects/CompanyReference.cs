namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>
/// Referencia a la empresa legal de un tenant (p. ej. RUC). Es opcional en el agregado; cuando se
/// informa, no puede ir vacía. Su unicidad entre tenants la verifica la aplicación con el repositorio.
/// </summary>
public sealed class CompanyReference : StringValueObject
{
    public const int MaxLength = 100;

    private static readonly TextRule Rule = new(
        nameof(CompanyReference), MaxLength, DomainErrors.Validation.CompanyReferenceRequired, DomainErrors.Validation.CompanyReferenceTooLong);

    private CompanyReference(string value) : base(value)
    {
    }

    public static CompanyReference Create(string? value) => new(value?.Trim() ?? string.Empty);

    public override void AddValidators()
    {
        base.AddValidators();
        ValidatorRules.Add(new TextRuleValidator(this, Rule));
    }
}
