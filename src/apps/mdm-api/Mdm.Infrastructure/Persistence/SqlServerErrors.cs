using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Mdm.Application.Common.Exceptions;

namespace Mdm.Infrastructure.Persistence;

/// <summary>
/// Traduce errores de SQL Server a las preguntas de la aplicación, para que ni los handlers ni el
/// dominio conozcan los números del motor.
/// </summary>
internal static partial class SqlServerErrors
{
    /// <summary>Fila duplicada en un índice único.</summary>
    private const int DuplicateKeyRowInUniqueIndex = 2601;

    /// <summary>Violación de restricción PRIMARY KEY o UNIQUE.</summary>
    private const int UniqueConstraintViolation = 2627;

    private static readonly string[] KnownIndexes =
    [
        DuplicateKeyConflictException.TenantCode,
        DuplicateKeyConflictException.TenantCompanyReference,
        DuplicateKeyConflictException.TenantBranchCode,
    ];

    /// <summary>
    /// <c>true</c> si el fallo es una violación de unicidad; <paramref name="constraint"/> es el
    /// nombre del índice o restricción. El mensaje de SQL Server se traduce con el idioma del
    /// inicio de sesión, así que se busca primero el nombre conocido y solo después una forma
    /// genérica de nombre con prefijo (<c>UX_</c>, <c>UQ_</c>, <c>PK_</c>).
    /// </summary>
    public static bool TryGetUniqueViolation(DbUpdateException exception, out string constraint)
    {
        constraint = string.Empty;
        if (exception.InnerException is not SqlException sql
            || sql.Number is not (DuplicateKeyRowInUniqueIndex or UniqueConstraintViolation))
        {
            return false;
        }

        var message = sql.Message;
        constraint = KnownIndexes.FirstOrDefault(n => message.Contains(n, StringComparison.Ordinal))
            ?? ConstraintNamePattern().Match(message) switch
            {
                { Success: true } match => match.Groups[1].Value,
                _ => "desconocido",
            };
        return true;
    }

    [GeneratedRegex("'((?:UX|UQ|PK)_[^']+)'")]
    private static partial Regex ConstraintNamePattern();
}
