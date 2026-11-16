namespace Mdm.Domain.Kernel;

/// <summary>
/// Resultado de una operación de dominio: los errores de negocio viajan como valor, nunca como
/// excepción (ADR-0041 §3.B, ADR-0038). En el fallo, <see cref="Error"/> es un código ESTABLE de
/// <see cref="DomainErrors"/> —no un texto— para que la presentación lo traduzca a un código HTTP
/// y a un Problem Details sin interpretar mensajes.
/// </summary>
public class Result
{
    protected Result(bool isSuccess, string error)
    {
        if (isSuccess && !string.IsNullOrEmpty(error))
        {
            throw new InvalidOperationException("Un resultado exitoso no puede llevar error.");
        }

        if (!isSuccess && string.IsNullOrWhiteSpace(error))
        {
            throw new InvalidOperationException("Un resultado fallido debe llevar un código de error.");
        }

        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }

    public bool IsFailure => !IsSuccess;

    /// <summary>Código estable del error (vacío si la operación tuvo éxito).</summary>
    public string Error { get; }

    public static Result Success() => new(true, string.Empty);

    public static Result Failure(string errorCode) => new(false, errorCode);
}

/// <summary>Resultado con valor: <see cref="Value"/> solo es accesible si la operación tuvo éxito.</summary>
public sealed class Result<TValue> : Result
{
    private readonly TValue? _value;

    private Result(TValue? value, bool isSuccess, string error) : base(isSuccess, error)
    {
        _value = value;
    }

    public TValue Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("No se puede leer el valor de un resultado fallido.");

    public static Result<TValue> Success(TValue value) => new(value, true, string.Empty);

    public static new Result<TValue> Failure(string errorCode) => new(default, false, errorCode);
}
