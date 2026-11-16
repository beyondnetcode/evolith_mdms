namespace Mdm.Domain.Kernel.ValueObjects;

/// <summary>Identidad de una sede, generada por la aplicación como la del tenant.</summary>
public sealed class BranchId : IdValueObject
{
    private BranchId(Guid value) : base(value)
    {
    }

    public static new BranchId Create() => new(Guid.NewGuid());

    public static new BranchId Load(Guid value) => new(value);

    public override void AddValidators()
    {
        base.AddValidators();
        ValidatorRules.Add(new NonEmptyIdValidator(this, nameof(BranchId)));
    }
}
