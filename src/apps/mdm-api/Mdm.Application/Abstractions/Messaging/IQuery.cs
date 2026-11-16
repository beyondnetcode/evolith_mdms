namespace Mdm.Application.Abstractions.Messaging;

using MediatR;
using Mdm.Domain.Kernel;

/// <summary>Consulta de solo lectura: nunca modifica estado.</summary>
public interface IQuery<TResponse> : IRequest<Result<TResponse>>
{
}
