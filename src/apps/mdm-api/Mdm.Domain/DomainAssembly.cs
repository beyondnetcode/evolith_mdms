using System.Reflection;

namespace Mdm.Domain;

/// <summary>Marcador del ensamblado de la capa Domain, para pruebas de arquitectura.</summary>
public static class DomainAssembly
{
    public static readonly Assembly Reference = typeof(DomainAssembly).Assembly;
}
