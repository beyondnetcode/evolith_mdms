using FluentAssertions;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using Mdm.Domain.Organization.Tenant.Branch;
using Mdm.Infrastructure.Persistence;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

namespace Mdm.Infrastructure.Test.Persistence;

public sealed class TenantRecordMapperTest
{
    private static readonly ActorId Actor = ActorId.Create("tester");

    private static TenantAggregate NewTenant(string code = "organizacion")
    {
        var data = new NewTenant(
            Code.Create(code), Name.Create("Organización S.A."), OrganizationType.CLIENT, CompanyReference.Create("20100412447"));
        return TenantAggregate.Create(data, Actor).Value;
    }

    private static BranchId AddBranch(TenantAggregate tenant, string code)
    {
        var added = tenant.AddBranch(Code.Create(code), Name.Create("Sede " + code), Actor);
        added.IsSuccess.Should().BeTrue();
        return added.Value.BranchId;
    }

    [Fact]
    public void Roundtrip_conserva_version_estado_sedes_y_auditoria()
    {
        var tenant = NewTenant();
        var lima = AddBranch(tenant, "LIMA");
        var pisco = AddBranch(tenant, "PISCO");
        tenant.DeactivateBranch(lima, Actor, "remodelacion").IsSuccess.Should().BeTrue();
        tenant.CloseBranch(pisco, Actor, "cierre").IsSuccess.Should().BeTrue();
        tenant.Suspend(Actor).IsSuccess.Should().BeTrue();

        var record = TenantRecordMapper.ToRecord(tenant);
        var reloaded = TenantAggregate.Load(TenantRecordMapper.ToSnapshot(record));

        reloaded.Version.Should().Be(tenant.Version);
        reloaded.PersistedVersion.Should().Be(tenant.Version);
        reloaded.TenantId.GetValue().Should().Be(tenant.TenantId.GetValue());
        reloaded.Code.GetValue().Should().Be(tenant.Code.GetValue());
        reloaded.Name.GetValue().Should().Be("Organización S.A.");
        reloaded.Type.Should().Be(OrganizationType.CLIENT);
        reloaded.Status.Should().Be(TenantStatus.Suspended);
        reloaded.CompanyReference!.GetValue().Should().Be("20100412447");
        reloaded.ParentTenantId.Should().BeNull();
        reloaded.Audit.GetValue().Should().BeEquivalentTo(
            tenant.Audit.GetValue(), o => o.Using<DateTime>(c => c.Subject.Should().BeCloseTo(c.Expectation, TimeSpan.FromMilliseconds(1))).WhenTypeIs<DateTime>());
        reloaded.Branches.Should().HaveCount(2);

        var limaLoaded = reloaded.Branches.Single(b => b.BranchId.GetValue() == lima.GetValue());
        limaLoaded.IsActive.Should().BeFalse();
        limaLoaded.IsClosed.Should().BeFalse();
        var piscoLoaded = reloaded.Branches.Single(b => b.BranchId.GetValue() == pisco.GetValue());
        piscoLoaded.IsClosed.Should().BeTrue();
        piscoLoaded.ClosedAtUtc.Should().Be(tenant.Branches.Single(b => b.IsClosed).ClosedAtUtc);
        piscoLoaded.ClosedBy!.GetValue().Should().Be("tester");
    }

    [Fact]
    public void Un_agregado_rehidratado_no_trae_eventos_ni_asientos_de_bitacora()
    {
        var tenant = NewTenant();
        AddBranch(tenant, "LIMA");

        var reloaded = TenantAggregate.Load(TenantRecordMapper.ToSnapshot(TenantRecordMapper.ToRecord(tenant)));

        reloaded.DomainEvents.GetUncommittedChanges().Should().BeEmpty();
        reloaded.PendingBranchLifecycleEntries.Should().BeEmpty();
    }

    [Fact]
    public void Roundtrip_de_la_bitacora_no_pierde_ningun_dato()
    {
        var tenant = NewTenant();
        var lima = AddBranch(tenant, "LIMA");
        tenant.DeactivateBranch(lima, Actor, "pausa").IsSuccess.Should().BeTrue();

        var entries = tenant.PendingBranchLifecycleEntries.ToList();
        var back = entries.Select(e => TenantRecordMapper.ToEntry(TenantRecordMapper.ToEntryRecord(e))).ToList();

        entries.Should().HaveCount(2);
        back.Should().BeEquivalentTo(entries);
    }

    [Fact]
    public void ApplyTo_vuelca_la_version_y_devuelve_solo_las_sedes_nuevas()
    {
        var tenant = NewTenant();
        var lima = AddBranch(tenant, "LIMA");
        var record = TenantRecordMapper.ToRecord(tenant);
        var loaded = TenantAggregate.Load(TenantRecordMapper.ToSnapshot(record));

        loaded.UpdateBranch(BranchId.Load(lima.GetValue()), Name.Create("Lima centro"), Actor).IsSuccess.Should().BeTrue();
        loaded.AddBranch(Code.Create("CUSCO"), Name.Create("Sede Cusco"), Actor).IsSuccess.Should().BeTrue();
        var added = TenantRecordMapper.ApplyTo(loaded, record);

        record.Version.Should().Be(loaded.Version);
        loaded.PersistedVersion.Should().Be(tenant.Version);
        record.Branches.Single().Name.Should().Be("Lima centro");
        added.Should().ContainSingle().Which.Code.Should().Be("CUSCO");
        added[0].TenantId.Should().Be(tenant.TenantId.GetValue());
    }

    [Theory]
    [InlineData(DateTimeKind.Utc)]
    [InlineData(DateTimeKind.Unspecified)]
    [InlineData(DateTimeKind.Local)]
    public void Instants_normaliza_cualquier_Kind_a_UTC(DateTimeKind kind)
    {
        var utc = new DateTime(2026, 10, 21, 13, 0, 0, DateTimeKind.Utc);
        var source = kind switch
        {
            DateTimeKind.Local => utc.ToLocalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(utc, DateTimeKind.Unspecified),
            _ => utc,
        };

        Instants.ToOffset(source).Should().Be(new DateTimeOffset(utc));
        Instants.ToOffset(source).Offset.Should().Be(TimeSpan.Zero);
    }
}
