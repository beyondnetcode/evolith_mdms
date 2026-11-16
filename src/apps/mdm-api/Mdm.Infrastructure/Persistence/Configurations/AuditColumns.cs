using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Mdm.Infrastructure.Persistence.Records;

namespace Mdm.Infrastructure.Persistence.Configurations;

internal static class AuditColumns
{
    /// <summary>Longitud de <c>ActorId.MaxLength</c> del dominio: el actor se guarda sin truncar.</summary>
    internal const int ActorLength = Mdm.Domain.Kernel.ValueObjects.ActorId.MaxLength;

    /// <summary>MDM-001 D2: todo instante es <c>datetimeoffset(3)</c>.</summary>
    internal const string InstantType = "datetimeoffset(3)";

    internal static void ConfigureAudit<T>(this EntityTypeBuilder<T> builder)
        where T : AuditedRecord
    {
        builder.Property(x => x.CreatedBy).HasMaxLength(ActorLength).IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnType(InstantType).IsRequired();
        builder.Property(x => x.UpdatedBy).HasMaxLength(ActorLength);
        builder.Property(x => x.UpdatedAt).HasColumnType(InstantType);
        // «d.hh:mm:ss.fffffff» ocupa unos 24 caracteres.
        builder.Property(x => x.AuditTimeSpan).HasMaxLength(32).IsRequired();
    }
}
