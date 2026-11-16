namespace Mdm.Application.Test.Common;

using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Mdm.Application.Common;
using Mdm.Application.Organization.Abstractions;
using Mdm.Application.Organization.Tenants.Commands;
using Mdm.Domain.Kernel;
using Mdm.Domain.Organization.Tenant;

public sealed class AddApplicationTest
{
    private static ServiceProvider Provider()
    {
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(u => u.ActorId).Returns("usuario-001");
        var services = new ServiceCollection();
        services.AddSingleton(new Mock<ITenantRepository>().Object);
        services.AddSingleton(new Mock<IUnitOfWork>().Object);
        services.AddSingleton(new Mock<ITenantReadStore>().Object);
        services.AddSingleton(currentUser.Object);
        services.AddApplication();
        return services.BuildServiceProvider(validateScopes: true);
    }

    [Fact]
    public async Task Comando_invalido_cortocircuita_en_el_pipeline_con_codigo_de_validacion()
    {
        using var provider = Provider();
        using var scope = provider.CreateScope();

        var result = await scope.ServiceProvider.GetRequiredService<ISender>()
            .Send(new CreateTenantCommand("", "Organización", "INTERNAL"), TestContext.Current.CancellationToken);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(DomainErrors.Validation.CodeRequired);
    }

    [Fact]
    public async Task Comando_valido_llega_al_handler_registrado()
    {
        using var provider = Provider();
        using var scope = provider.CreateScope();

        var result = await scope.ServiceProvider.GetRequiredService<ISender>()
            .Send(new CreateTenantCommand("LIMA", "Organización", "INTERNAL"), TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue(result.Error);
        result.Value.Version.Should().Be(1);
    }
}
