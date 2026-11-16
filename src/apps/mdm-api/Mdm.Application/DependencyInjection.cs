namespace Mdm.Application;

using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Mdm.Application.Common.Behaviors;
using Mdm.Application.Organization;

/// <summary>Registro de la capa Application en el contenedor nativo (ADR-0041).</summary>
public static class DependencyInjection
{
    /// <summary>
    /// MediatR (handlers del ensamblado), validadores de FluentValidation y el
    /// <see cref="ValidationBehavior{TRequest, TResponse}"/> como primer paso del pipeline. Los puertos
    /// (<c>ITenantRepository</c>, <c>IUnitOfWork</c>, <c>ITenantReadStore</c>, <c>ICurrentUser</c>) los
    /// registran Infrastructure y Presentation.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(ApplicationAssembly.Reference);
            cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(ApplicationAssembly.Reference, includeInternalTypes: true);
        services.AddScoped<TenantMutationExecutor>();
        return services;
    }
}
