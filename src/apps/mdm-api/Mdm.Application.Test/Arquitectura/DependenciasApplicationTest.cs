
namespace Mdm.Application.Test.Arquitectura;

public sealed class DependenciasApplicationTest
{
    [Theory]
    [InlineData("Mdm.Infrastructure")]
    [InlineData("Mdm.Presentation")]
    public void Application_no_depende_de_capas_externas(string capaExterna)
    {
        var referencias = ApplicationAssembly.Reference
            .GetReferencedAssemblies()
            .Select(a => a.Name);

        referencias.Should().NotContain(capaExterna);
    }
}
