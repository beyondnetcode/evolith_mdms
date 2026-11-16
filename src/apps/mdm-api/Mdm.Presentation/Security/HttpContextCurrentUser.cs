using Mdm.Application.Common;

namespace Mdm.Presentation.Security;

/// <summary>
/// <see cref="ICurrentUser"/> desde el claim <c>sub</c> del portador ya validado. Jamás desde una
/// cabecera libre: quien actúa lo afirma la firma de UMS, no el cliente.
/// </summary>
internal sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public string? ActorId
    {
        get
        {
            var user = accessor.HttpContext?.User;
            return user?.Identity?.IsAuthenticated == true
                ? user.FindFirst(CurrentUserClaims.Subject)?.Value
                : null;
        }
    }
}
