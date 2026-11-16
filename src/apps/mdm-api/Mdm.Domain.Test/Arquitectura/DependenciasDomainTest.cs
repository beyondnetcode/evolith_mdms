using FluentAssertions;

namespace Mdm.Domain.Test.Arquitectura;

public sealed class DependenciasDomainTest
{
    [Fact]
    public void Domain_no_depende_de_ninguna_otra_capa_de_MDM()
    {
        var referencias = DomainAssembly.Reference
            .GetReferencedAssemblies()
            .Select(a => a.Name);

        referencias.Should().NotContain(n => n != null && n.StartsWith("Mdm.", StringComparison.Ordinal));
    }
}
