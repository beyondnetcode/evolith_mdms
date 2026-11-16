using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Mdm.Presentation.Http;

/// <summary>
/// Instantes con milisegundos y desfase fijos (<c>2026-10-21T15:04:05.123+00:00</c>), como exige el
/// contrato §1. El formato por defecto de System.Text.Json omite ceros finales y los hace variar.
/// </summary>
public sealed class Iso8601MillisecondsConverter : JsonConverter<DateTimeOffset>
{
    private const string Format = "yyyy-MM-dd'T'HH:mm:ss.fffzzz";

    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTimeOffset();

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(writer);
        writer.WriteStringValue(value.ToString(Format, CultureInfo.InvariantCulture));
    }
}
