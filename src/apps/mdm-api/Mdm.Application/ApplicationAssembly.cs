using System.Reflection;

namespace Mdm.Application;

/// <summary>Marcador del ensamblado de la capa Application, para pruebas de arquitectura.</summary>
public static class ApplicationAssembly
{
    public static readonly Assembly Reference = typeof(ApplicationAssembly).Assembly;
}
