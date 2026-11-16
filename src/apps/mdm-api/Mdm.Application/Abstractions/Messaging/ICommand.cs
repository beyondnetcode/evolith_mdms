namespace Mdm.Application.Abstractions.Messaging;

using MediatR;
using Mdm.Domain.Kernel;

/// <summary>Comando sin valor de retorno: modifica estado y responde éxito o un código de error.</summary>
public interface ICommand : IRequest<Result>
{
}

/// <summary>Comando que devuelve un valor en caso de éxito.</summary>
public interface ICommand<TResponse> : IRequest<Result<TResponse>>
{
}
