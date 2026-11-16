namespace Mdm.Domain.Kernel;

/// <summary>Puente entre las reglas rotas de la shell DDD y el <see cref="Result"/> del dominio.</summary>
internal static class BrokenRulesExtensions
{
    /// <summary>
    /// Código de la PRIMERA regla rota. La shell acumula reglas en orden de detección; el agregado
    /// las registra de la más específica a la más general, así que la primera es la causa.
    /// </summary>
    public static string FirstErrorCode(this BrokenRulesManager brokenRules)
    {
        var rules = brokenRules.GetBrokenRules();
        return rules.Count == 0 ? string.Empty : rules[0].Message;
    }

    /// <summary>
    /// Copia al agregado las reglas rotas de un objeto de valor que llega como ARGUMENTO de una
    /// transición, antes de asignarlo: así el agregado no queda mutado con un valor inválido aunque
    /// la operación devuelva fallo. Un opcional ausente (<c>null</c>) no aporta reglas.
    /// </summary>
    public static void AddBrokenRulesOf<TValue>(this BrokenRulesManager target, ValueObject<TValue>? valueObject)
    {
        if (valueObject is null)
        {
            return;
        }

        target.Add(valueObject.BrokenRules.GetBrokenRules());
    }
}
