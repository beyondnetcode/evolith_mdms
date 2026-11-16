using FluentAssertions;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;

namespace Mdm.Domain.Test.Kernel;

public sealed class ValueObjectsTest
{
    [Theory]
    [InlineData("  lima centro ", "LIMA_CENTRO")]
    [InlineData("Callao-01", "CALLAO-01")]
    [InlineData("ya_NORMAL", "YA_NORMAL")]
    public void Code_se_normaliza_trim_mayusculas_y_espacios_a_guion_bajo(string entrada, string esperado)
    {
        Code.Create(entrada).GetValue().Should().Be(esperado);
    }

    [Fact]
    public void Codes_con_distinta_forma_de_escritura_son_iguales()
    {
        Code.Create("lima 01").Should().Be(Code.Create("LIMA_01"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Code_vacio_rompe_la_regla_de_obligatorio(string? entrada)
    {
        PrimerError(Code.Create(entrada).BrokenRules.GetBrokenRules()).Should().Be(DomainErrors.Validation.CodeRequired);
    }

    [Fact]
    public void Code_demasiado_largo_rompe_la_regla_de_longitud()
    {
        var code = Code.Create(new string('A', Code.MaxLength + 1));

        PrimerError(code.BrokenRules.GetBrokenRules()).Should().Be(DomainErrors.Validation.CodeTooLong);
    }

    [Fact]
    public void Code_en_el_limite_es_valido()
    {
        Code.Create(new string('A', Code.MaxLength)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Name_se_recorta_y_valida_obligatorio_y_longitud()
    {
        Name.Create("  Sede Lima  ").GetValue().Should().Be("Sede Lima");
        PrimerError(Name.Create(" ").BrokenRules.GetBrokenRules()).Should().Be(DomainErrors.Validation.NameRequired);
        PrimerError(Name.Create(new string('n', Name.MaxLength + 1)).BrokenRules.GetBrokenRules())
            .Should().Be(DomainErrors.Validation.NameTooLong);
    }

    [Fact]
    public void CompanyReference_valida_obligatorio_y_longitud()
    {
        CompanyReference.Create(" 20100412447 ").GetValue().Should().Be("20100412447");
        PrimerError(CompanyReference.Create(null).BrokenRules.GetBrokenRules())
            .Should().Be(DomainErrors.Validation.CompanyReferenceRequired);
        PrimerError(CompanyReference.Create(new string('9', CompanyReference.MaxLength + 1)).BrokenRules.GetBrokenRules())
            .Should().Be(DomainErrors.Validation.CompanyReferenceTooLong);
    }

    [Fact]
    public void ActorId_valida_obligatorio_y_longitud()
    {
        PrimerError(ActorId.Create(null).BrokenRules.GetBrokenRules()).Should().Be(DomainErrors.Validation.ActorRequired);
        PrimerError(ActorId.Create(new string('x', ActorId.MaxLength + 1)).BrokenRules.GetBrokenRules())
            .Should().Be(DomainErrors.Validation.ActorTooLong);
    }

    [Fact]
    public void Ids_vacios_rompen_la_regla_y_los_generados_no()
    {
        PrimerError(TenantId.Load(Guid.Empty).BrokenRules.GetBrokenRules()).Should().Be(DomainErrors.Validation.IdRequired);
        PrimerError(BranchId.Load(Guid.Empty).BrokenRules.GetBrokenRules()).Should().Be(DomainErrors.Validation.IdRequired);
        TenantId.Create().IsValid.Should().BeTrue();
        BranchId.Create().IsValid.Should().BeTrue();
    }

    [Fact]
    public void NormalizeOptionalText_convierte_blancos_en_nulo()
    {
        DomainGuards.NormalizeOptionalText("   ").Should().BeNull();
        DomainGuards.NormalizeOptionalText(" motivo ").Should().Be("motivo");
    }

    private static string? PrimerError(IReadOnlyList<Unimar.Shells.Net.Ddd.Rules.BrokenRule> reglas) =>
        reglas.Count == 0 ? null : reglas[0].Message;
}
