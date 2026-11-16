using FluentAssertions;

namespace Mdm.Infrastructure.Test.Arquitectura;

public sealed class DependenciasInfrastructureTest
{
    [Fact]
    public void Infrastructure_no_depende_de_Presentation_ni_de_las_migraciones()
    {
        var referencias = InfrastructureAssembly.Reference
            .GetReferencedAssemblies()
            .Select(a => a.Name);

        referencias.Should().NotContain("Mdm.Presentation");
        // Las migraciones dependen de Infrastructure; la flecha inversa es un ciclo.
        referencias.Should().NotContain(DependencyInjection.MigrationsAssembly);
    }

    [Fact]
    public void Infrastructure_depende_de_Application_y_Domain_hacia_adentro()
    {
        var referencias = InfrastructureAssembly.Reference
            .GetReferencedAssemblies()
            .Select(a => a.Name);

        referencias.Should().Contain("Mdm.Application");
    }
}
