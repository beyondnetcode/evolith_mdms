namespace Mdm.Application.Common;

/// <summary>
/// Puerto del usuario autenticado de la petición. La presentación lo implementa desde los claims
/// del token; la aplicación solo necesita el identificador para auditoría y bitácora.
/// </summary>
public interface ICurrentUser
{
    /// <summary>Identificador del sujeto autenticado, o <c>null</c> si no hay sesión.</summary>
    string? ActorId { get; }
}
