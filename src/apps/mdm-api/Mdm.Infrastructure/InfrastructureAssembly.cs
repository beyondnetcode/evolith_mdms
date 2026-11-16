using System.Reflection;

namespace Mdm.Infrastructure;

/// <summary>Marcador del ensamblado de la capa Infrastructure, para pruebas de arquitectura.</summary>
public static class InfrastructureAssembly
{
    public static readonly Assembly Reference = typeof(InfrastructureAssembly).Assembly;
}
