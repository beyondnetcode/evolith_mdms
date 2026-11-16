namespace Mdm.Application.Abstractions.Messaging;

using MediatR;
using Mdm.Domain.Kernel;

public interface IQueryHandler<in TQuery, TResponse> : IRequestHandler<TQuery, Result<TResponse>>
    where TQuery : IQuery<TResponse>
{
}
