using FluentAssertions;
using Mdm.Domain.Kernel;

namespace Mdm.Domain.Test.Kernel;

public sealed class ResultTest
{
    [Fact]
    public void Exito_no_lleva_error_y_expone_el_valor()
    {
        var result = Result<int>.Success(7);

        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
        result.Error.Should().BeEmpty();
        result.Value.Should().Be(7);
    }

    [Fact]
    public void Fallo_lleva_el_codigo_y_no_expone_valor()
    {
        var result = Result<int>.Failure(DomainErrors.Tenant.NotFound);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(DomainErrors.Tenant.NotFound);
        var leer = () => result.Value;
        leer.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Fallo_sin_codigo_es_un_error_de_programacion()
    {
        var crear = () => Result.Failure(" ");

        crear.Should().Throw<InvalidOperationException>();
    }
}
