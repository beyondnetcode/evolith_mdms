namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>
/// Identidad de un tenant. La genera la aplicación (no la base) para poder importar los ids de UMS
/// y publicarlos tal cual como <c>Subject</c> de <c>TenantEvent</c> (plan T2, ADR-0229 Anexo A).
/// </summary>
public sealed class TenantId : IdValueObject
{
    private TenantId(Guid value) : base(value)
    {
    }

    public static new TenantId Create() => new(Guid.NewGuid());

    public static new TenantId Load(Guid value) => new(value);

    public override void AddValidators()
    {
        base.AddValidators();
        ValidatorRules.Add(new NonEmptyIdValidator(this, nameof(TenantId)));
    }
}
