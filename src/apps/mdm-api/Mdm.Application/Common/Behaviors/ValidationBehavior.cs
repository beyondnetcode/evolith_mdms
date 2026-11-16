namespace Mdm.Application.Common.Behaviors;

using System.Reflection;
using FluentValidation;
using MediatR;
using Mdm.Domain.Kernel;

/// <summary>
/// Valida cada petición con sus <see cref="IValidator{T}"/> antes de llegar al handler. Si hay
/// errores NO lanza: devuelve <c>Result.Failure</c> con el código <c>validation.*</c> del primer
/// error (el mensaje de cada regla ES el código estable), para que la presentación lo traduzca a
/// 400 sin interpretar textos.
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private static readonly Func<string, TResponse> FailureFactory = CreateFailureFactory();

    private readonly IReadOnlyCollection<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators.ToArray();
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);
        if (_validators.Count == 0)
        {
            return await next();
        }

        var context = new ValidationContext<TRequest>(request);
        var results = await Task.WhenAll(_validators.Select(v => v.ValidateAsync(context, cancellationToken)));
        var firstError = results
            .SelectMany(r => r.Errors)
            .Select(e => e.ErrorMessage)
            .FirstOrDefault(m => !string.IsNullOrWhiteSpace(m));

        return firstError is null ? await next() : FailureFactory(firstError);
    }

    private static Func<string, TResponse> CreateFailureFactory()
    {
        if (typeof(TResponse) == typeof(Result))
        {
            return error => (TResponse)(object)Result.Failure(error);
        }

        if (typeof(TResponse).IsGenericType && typeof(TResponse).GetGenericTypeDefinition() == typeof(Result<>))
        {
            var failure = typeof(TResponse).GetMethod(
                nameof(Result.Failure),
                BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly,
                [typeof(string)])!;
            return (Func<string, TResponse>)Delegate.CreateDelegate(typeof(Func<string, TResponse>), failure);
        }

        return _ => throw new InvalidOperationException(
            $"ValidationBehavior no puede crear un resultado fallido para '{typeof(TResponse).Name}'.");
    }
}
