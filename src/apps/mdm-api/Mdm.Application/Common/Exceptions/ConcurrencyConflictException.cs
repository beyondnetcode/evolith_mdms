namespace Mdm.Application.Common.Exceptions;

/// <summary>
/// La unidad de trabajo detectó que otro proceso modificó el agregado entre la lectura y el
/// guardado (la versión persistida ya no coincide). La lanza la infraestructura al traducir el
/// conflicto del motor; los handlers la convierten a <c>concurrency.version_mismatch</c>.
/// </summary>
public sealed class ConcurrencyConflictException : Exception
{
    public ConcurrencyConflictException()
        : base("La versión persistida del agregado no coincide con la esperada.")
    {
    }

    public ConcurrencyConflictException(string message)
        : base(message)
    {
    }

    public ConcurrencyConflictException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
