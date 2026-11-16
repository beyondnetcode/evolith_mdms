namespace Mdm.Domain.Test.Organization.Tenant;

using FluentAssertions;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using Mdm.Domain.Organization.Tenant.Branch;
using Mdm.Domain.Organization.Tenant.Events;
using Unimar.Shells.Net.Ddd.ValueObjects.Audit;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

public sealed class TenantTest
{
    private static readonly ActorId Actor = TenantMother.Actor;

    // ── Alta ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_con_datos_validos_nace_activo_version_1_y_emite_TenantCreated()
    {
        var id = TenantId.Create();

        var result = TenantAggregate.Create(TenantMother.NewTenantData(" organizacion sa ", id), Actor);

        result.IsSuccess.Should().BeTrue();
        var tenant = result.Value;
        tenant.TenantId.GetValue().Should().Be(id.GetValue());
        tenant.Id.GetValue().Should().Be(id.GetValue(), "la identidad de la shell coincide con la del maestro");
        tenant.Code.GetValue().Should().Be("ORG_SA");
        tenant.Status.Should().Be(TenantStatus.Active);
        tenant.Type.Should().Be(OrganizationType.INTERNAL);
        tenant.Version.Should().Be(1);
        tenant.PersistedVersion.Should().Be(0);
        tenant.Branches.Should().BeEmpty();
        tenant.Audit.GetValue().CreatedBy.Should().Be(Actor.GetValue());
        tenant.DomainEvents.GetUncommittedChanges().Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { TenantId = id.GetValue(), Version = 1L, Code = "ORG_SA" });
    }

    [Fact]
    public void Create_sin_id_genera_uno()
    {
        var tenant = TenantAggregate.Create(TenantMother.NewTenantData(), Actor).Value;

        tenant.TenantId.GetValue().Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_con_matriz_la_conserva()
    {
        var parent = TenantId.Create();
        var data = TenantMother.NewTenantData() with { ParentTenantId = parent };

        var tenant = TenantAggregate.Create(data, Actor).Value;

        tenant.ParentTenantId!.GetValue().Should().Be(parent.GetValue());
    }

    [Theory]
    [MemberData(nameof(AltasInvalidas))]
    public void Create_invalido_falla_con_codigo_estable(NewTenant data, string actor, string codigoEsperado)
    {
        var result = TenantAggregate.Create(data, ActorId.Create(actor));

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(codigoEsperado);
    }

    public static TheoryData<NewTenant, string, string> AltasInvalidas()
    {
        var valido = TenantMother.NewTenantData();
        var mismoId = TenantId.Create();
        return new TheoryData<NewTenant, string, string>
        {
            { valido with { Code = Code.Create(" ") }, "u", DomainErrors.Validation.CodeRequired },
            { valido with { Name = Name.Create("") }, "u", DomainErrors.Validation.NameRequired },
            { valido with { CompanyReference = CompanyReference.Create(" ") }, "u", DomainErrors.Validation.CompanyReferenceRequired },
            { valido with { Type = null! }, "u", DomainErrors.Tenant.OrganizationTypeRequired },
            { valido with { Id = mismoId, ParentTenantId = mismoId }, "u", DomainErrors.Tenant.ParentInvalid },
            { valido with { Id = TenantId.Load(Guid.Empty) }, "u", DomainErrors.Validation.IdRequired },
            { valido, " ", DomainErrors.Validation.ActorRequired },
        };
    }

    [Fact]
    public void Create_sin_datos_es_un_error_de_programacion()
    {
        var crear = () => TenantAggregate.Create(null!, Actor);

        crear.Should().Throw<ArgumentNullException>();
    }

    // ── Datos generales ─────────────────────────────────────────────────────

    [Fact]
    public void UpdateGeneralData_cambia_datos_conserva_el_codigo_sube_version_y_emite_evento()
    {
        var tenant = TenantMother.Active();
        var data = new TenantGeneralData(Name.Create("Cliente S.A.C."), OrganizationType.CLIENT, null);

        var result = tenant.UpdateGeneralData(data, ActorId.Create("editor"));

        result.IsSuccess.Should().BeTrue();
        tenant.Name.GetValue().Should().Be("Cliente S.A.C.");
        tenant.Type.Should().Be(OrganizationType.CLIENT);
        tenant.CompanyReference.Should().BeNull();
        tenant.Code.GetValue().Should().Be("ORG");
        tenant.Version.Should().Be(2);
        tenant.Audit.GetValue().UpdatedBy.Should().Be("editor");
        tenant.DomainEvents.GetUncommittedChanges().Should().ContainSingle().Which.Should().BeOfType<TenantUpdatedEvent>()
            .Which.Version.Should().Be(2);
    }

    [Theory]
    [MemberData(nameof(EdicionesInvalidas))]
    public void UpdateGeneralData_invalido_no_muta_ni_sube_version(TenantGeneralData data, string codigoEsperado)
    {
        var tenant = TenantMother.Active();

        var result = tenant.UpdateGeneralData(data, Actor);

        result.Error.Should().Be(codigoEsperado);
        tenant.Name.GetValue().Should().Be("Organización S.A.");
        tenant.Type.Should().Be(OrganizationType.INTERNAL);
        tenant.Version.Should().Be(1);
        tenant.DomainEvents.GetUncommittedChanges().Should().BeEmpty();
    }

    public static TheoryData<TenantGeneralData, string> EdicionesInvalidas() => new()
    {
        { new TenantGeneralData(Name.Create(" "), OrganizationType.CLIENT, null), DomainErrors.Validation.NameRequired },
        { new TenantGeneralData(Name.Create("Ok"), null!, null), DomainErrors.Tenant.OrganizationTypeRequired },
        {
            new TenantGeneralData(Name.Create("Ok"), OrganizationType.CLIENT, CompanyReference.Create(new string('9', 101))),
            DomainErrors.Validation.CompanyReferenceTooLong
        },
    };

    [Fact]
    public void UpdateGeneralData_en_tenant_archivado_falla()
    {
        var tenant = TenantMother.Active();
        tenant.Archive(Actor);

        var result = tenant.UpdateGeneralData(new TenantGeneralData(Name.Create("X"), OrganizationType.CLIENT, null), Actor);

        result.Error.Should().Be(DomainErrors.Tenant.Archived);
    }

    [Fact]
    public void Un_fallo_previo_no_contamina_la_siguiente_operacion()
    {
        var tenant = TenantMother.Active();
        tenant.UpdateGeneralData(new TenantGeneralData(Name.Create(" "), OrganizationType.CLIENT, null), Actor)
            .IsFailure.Should().BeTrue();

        var result = tenant.UpdateGeneralData(new TenantGeneralData(Name.Create("Válido"), OrganizationType.CLIENT, null), Actor);

        result.IsSuccess.Should().BeTrue();
    }

    // ── Estados ─────────────────────────────────────────────────────────────

    [Fact]
    public void Suspend_y_Activate_recorren_el_ciclo_reversible()
    {
        var tenant = TenantMother.Active();

        tenant.Suspend(Actor).IsSuccess.Should().BeTrue();
        tenant.Status.Should().Be(TenantStatus.Suspended);
        tenant.Activate(Actor).IsSuccess.Should().BeTrue();
        tenant.Status.Should().Be(TenantStatus.Active);

        tenant.Version.Should().Be(3);
        tenant.DomainEvents.GetUncommittedChanges().Select(e => e.GetType())
            .Should().Equal(typeof(TenantSuspendedEvent), typeof(TenantActivatedEvent));
    }

    [Fact]
    public void Archive_desde_activo_o_suspendido_es_terminal()
    {
        var activo = TenantMother.Active();
        var suspendido = TenantMother.Active();
        suspendido.Suspend(Actor);

        activo.Archive(Actor).IsSuccess.Should().BeTrue();
        suspendido.Archive(Actor).IsSuccess.Should().BeTrue();

        activo.Status.Should().Be(TenantStatus.Archived);
        activo.DomainEvents.GetUncommittedChanges().Should().ContainSingle().Which.Should().BeOfType<TenantArchivedEvent>();
        activo.Archive(Actor).Error.Should().Be(DomainErrors.Tenant.Archived);
        activo.Activate(Actor).Error.Should().Be(DomainErrors.Tenant.Archived);
        activo.Suspend(Actor).Error.Should().Be(DomainErrors.Tenant.Archived);
        activo.Version.Should().Be(2, "los intentos fallidos no suben la versión");
    }

    [Fact]
    public void Transiciones_desde_el_mismo_estado_son_invalidas()
    {
        var tenant = TenantMother.Active();

        tenant.Activate(Actor).Error.Should().Be(DomainErrors.Tenant.AlreadyActive);
        tenant.Suspend(Actor);
        tenant.Suspend(Actor).Error.Should().Be(DomainErrors.Tenant.AlreadySuspended);
    }

    [Fact]
    public void Suspend_y_Archive_se_bloquean_con_sedes_activas_no_cerradas()
    {
        var tenant = TenantMother.Active();
        TenantMother.AddBranch(tenant);

        tenant.Suspend(Actor).Error.Should().Be(DomainErrors.Tenant.HasActiveBranches);
        tenant.Archive(Actor).Error.Should().Be(DomainErrors.Tenant.HasActiveBranches);
        tenant.Status.Should().Be(TenantStatus.Active);
    }

    [Fact]
    public void Suspend_y_Archive_se_permiten_con_sedes_inactivas_o_cerradas()
    {
        var tenant = TenantMother.Active();
        var inactiva = TenantMother.AddBranch(tenant, "LIMA");
        var cerrada = TenantMother.AddBranch(tenant, "CALLAO");
        tenant.DeactivateBranch(BranchId.Load(inactiva), Actor);
        tenant.CloseBranch(BranchId.Load(cerrada), Actor);

        tenant.Suspend(Actor).IsSuccess.Should().BeTrue();
        tenant.Archive(Actor).IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void Las_operaciones_exigen_actor()
    {
        var tenant = TenantMother.Active();

        tenant.Suspend(ActorId.Create("")).Error.Should().Be(DomainErrors.Validation.ActorRequired);
        tenant.Version.Should().Be(1);
    }

    // ── Rehidratación y persistencia ────────────────────────────────────────

    [Fact]
    public void Load_reconstruye_estado_y_sedes_sin_eventos_ni_bitacora()
    {
        var tenantId = Guid.NewGuid();
        var parentId = Guid.NewGuid();
        var audit = new AuditProps { CreatedBy = "migracion", CreatedAt = DateTime.UtcNow, TimeSpan = "0" };
        var cerradaEl = DateTimeOffset.UtcNow.AddDays(-3);
        var snapshot = new TenantSnapshot(
            tenantId, "ORG", "Organización S.A.", OrganizationType.SUPPLIER.Id, "20100412447", parentId,
            TenantStatus.Suspended.Id, audit, Version: 42,
            [
                new BranchSnapshot(Guid.NewGuid(), tenantId, "LIMA", "Sede Lima", true, false, null, null, audit),
                new BranchSnapshot(Guid.NewGuid(), tenantId, "PISCO", "Sede Pisco", false, true, cerradaEl, "cierre", audit),
            ]);

        var tenant = TenantAggregate.Load(snapshot);

        tenant.TenantId.GetValue().Should().Be(tenantId);
        tenant.Type.Should().Be(OrganizationType.SUPPLIER);
        tenant.Status.Should().Be(TenantStatus.Suspended);
        tenant.ParentTenantId!.GetValue().Should().Be(parentId);
        tenant.CompanyReference!.GetValue().Should().Be("20100412447");
        tenant.Version.Should().Be(42);
        tenant.PersistedVersion.Should().Be(42);
        tenant.Audit.GetValue().CreatedBy.Should().Be("migracion");
        tenant.Branches.Should().HaveCount(2);
        var pisco = tenant.Branches.Single(b => b.Code.GetValue() == "PISCO");
        pisco.IsClosed.Should().BeTrue();
        pisco.ClosedAtUtc.Should().Be(cerradaEl);
        pisco.ClosedBy!.GetValue().Should().Be("cierre");
        tenant.DomainEvents.GetUncommittedChanges().Should().BeEmpty();
        tenant.PendingBranchLifecycleEntries.Should().BeEmpty();
        tenant.TrackingState.IsDirty.Should().BeFalse();
    }

    [Fact]
    public void Load_sin_referencia_ni_matriz_los_deja_nulos()
    {
        var audit = new AuditProps { CreatedBy = "m", CreatedAt = DateTime.UtcNow, TimeSpan = "0" };
        var snapshot = new TenantSnapshot(
            Guid.NewGuid(), "X", "X", OrganizationType.CLIENT.Id, " ", null, TenantStatus.Active.Id, audit, 1, []);

        var tenant = TenantAggregate.Load(snapshot);

        tenant.CompanyReference.Should().BeNull();
        tenant.ParentTenantId.Should().BeNull();
    }

    [Fact]
    public void Load_con_enumeracion_desconocida_falla_rapido()
    {
        var audit = new AuditProps { CreatedBy = "m", CreatedAt = DateTime.UtcNow, TimeSpan = "0" };
        var snapshot = new TenantSnapshot(Guid.NewGuid(), "X", "X", 99, null, null, TenantStatus.Active.Id, audit, 1, []);

        var cargar = () => TenantAggregate.Load(snapshot);

        cargar.Should().Throw<InvalidOperationException>().WithMessage("*99*OrganizationType*");
    }

    [Fact]
    public void MarkAsPersisted_vacia_pendientes_y_fija_la_version_persistida()
    {
        var tenant = TenantAggregate.Create(TenantMother.NewTenantData(), Actor).Value;
        TenantMother.AddBranch(tenant);

        tenant.MarkAsPersisted();

        tenant.PersistedVersion.Should().Be(tenant.Version).And.Be(2);
        tenant.DomainEvents.GetUncommittedChanges().Should().BeEmpty();
        tenant.PendingBranchLifecycleEntries.Should().BeEmpty();
    }
}
