namespace Mdm.Domain.Test.Organization.Tenant.Branch;

using FluentAssertions;
using Mdm.Domain.Kernel;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using Mdm.Domain.Organization.Tenant.Branch;
using Mdm.Domain.Organization.Tenant.Events;
using Mdm.Domain.Test.Organization.Tenant;

public sealed class TenantBranchTest
{
    private static readonly ActorId Actor = TenantMother.Actor;

    // ── Alta ────────────────────────────────────────────────────────────────

    [Fact]
    public void AddBranch_crea_sede_activa_sube_version_emite_evento_y_anota_apertura()
    {
        var tenant = TenantMother.Active();

        var result = tenant.AddBranch(Code.Create(" lima centro "), Name.Create("Sede Lima"), Actor);

        result.IsSuccess.Should().BeTrue();
        var branch = result.Value;
        branch.Code.GetValue().Should().Be("LIMA_CENTRO");
        branch.TenantId.GetValue().Should().Be(tenant.TenantId.GetValue());
        branch.Id.GetValue().Should().Be(branch.BranchId.GetValue());
        branch.IsActive.Should().BeTrue();
        branch.IsClosed.Should().BeFalse();
        branch.Audit.GetValue().CreatedBy.Should().Be(Actor.GetValue());
        tenant.Branches.Should().ContainSingle();
        tenant.Version.Should().Be(2);
        tenant.DomainEvents.GetUncommittedChanges().Should().ContainSingle().Which.Should().BeOfType<BranchCreatedEvent>()
            .Which.Should().BeEquivalentTo(new { Version = 2L, BranchId = branch.BranchId.GetValue(), Code = "LIMA_CENTRO" });
        tenant.PendingBranchLifecycleEntries.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new
            {
                Episode = BranchLifecycleEpisode.Opened,
                BranchId = branch.BranchId.GetValue(),
                TenantId = tenant.TenantId.GetValue(),
                ActorId = Actor.GetValue(),
                NameSnapshot = "Sede Lima",
                Reason = (string?)null,
            });
    }

    [Fact]
    public void AddBranch_con_codigo_repetido_falla_aunque_se_escriba_distinto()
    {
        var tenant = TenantMother.Active();
        TenantMother.AddBranch(tenant, "LIMA CENTRO");

        var result = tenant.AddBranch(Code.Create("lima_centro"), Name.Create("Otra"), Actor);

        result.Error.Should().Be(DomainErrors.Tenant.BranchCodeNotUnique);
        tenant.Branches.Should().ContainSingle();
        tenant.Version.Should().Be(2);
    }

    [Fact]
    public void AddBranch_con_el_codigo_de_una_sede_cerrada_falla()
    {
        var tenant = TenantMother.Active();
        var cerrada = TenantMother.AddBranch(tenant, "PISCO");
        tenant.CloseBranch(BranchId.Load(cerrada), Actor);

        var result = tenant.AddBranch(Code.Create("PISCO"), Name.Create("Pisco nueva"), Actor);

        result.Error.Should().Be(DomainErrors.Tenant.BranchCodeNotUnique);
    }

    [Fact]
    public void AddBranch_con_el_mismo_codigo_en_otro_tenant_es_valido()
    {
        var a = TenantMother.Active("A");
        var b = TenantMother.Active("B");
        TenantMother.AddBranch(a, "LIMA");

        b.AddBranch(Code.Create("LIMA"), Name.Create("Lima"), Actor).IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void AddBranch_exige_tenant_activo()
    {
        var suspendido = TenantMother.Active();
        suspendido.Suspend(Actor);
        var archivado = TenantMother.Active();
        archivado.Archive(Actor);

        suspendido.AddBranch(Code.Create("X"), Name.Create("X"), Actor).Error.Should().Be(DomainErrors.Tenant.NotActive);
        archivado.AddBranch(Code.Create("X"), Name.Create("X"), Actor).Error.Should().Be(DomainErrors.Tenant.Archived);
    }

    [Fact]
    public void AddBranch_con_datos_invalidos_falla()
    {
        var tenant = TenantMother.Active();

        tenant.AddBranch(Code.Create(""), Name.Create("X"), Actor).Error.Should().Be(DomainErrors.Validation.CodeRequired);
        tenant.AddBranch(Code.Create("X"), Name.Create(""), Actor).Error.Should().Be(DomainErrors.Validation.NameRequired);
        tenant.Branches.Should().BeEmpty();
    }

    // ── Edición ─────────────────────────────────────────────────────────────

    [Fact]
    public void UpdateBranch_cambia_el_nombre_y_sube_la_version_del_tenant()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));
        tenant.MarkAsPersisted();

        var result = tenant.UpdateBranch(branchId, Name.Create("Sede Lima Norte"), ActorId.Create("editor"));

        result.IsSuccess.Should().BeTrue();
        var branch = tenant.Branches.Single();
        branch.Name.GetValue().Should().Be("Sede Lima Norte");
        branch.Code.GetValue().Should().Be("LIMA");
        branch.Audit.GetValue().UpdatedBy.Should().Be("editor");
        tenant.Version.Should().Be(3);
        tenant.DomainEvents.GetUncommittedChanges().Should().ContainSingle().Which.Should().BeOfType<BranchUpdatedEvent>();
        tenant.PendingBranchLifecycleEntries.Should().BeEmpty("editar el nombre no es un episodio del ciclo de vida");
    }

    [Fact]
    public void UpdateBranch_falla_si_no_existe_si_esta_cerrada_o_si_el_tenant_esta_archivado()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));

        tenant.UpdateBranch(BranchId.Create(), Name.Create("X"), Actor).Error.Should().Be(DomainErrors.Tenant.BranchNotFound);
        tenant.UpdateBranch(branchId, Name.Create(" "), Actor).Error.Should().Be(DomainErrors.Validation.NameRequired);

        tenant.CloseBranch(branchId, Actor);
        tenant.UpdateBranch(branchId, Name.Create("X"), Actor).Error.Should().Be(DomainErrors.Tenant.BranchClosed);

        tenant.Archive(Actor);
        tenant.UpdateBranch(branchId, Name.Create("X"), Actor).Error.Should().Be(DomainErrors.Tenant.Archived);
    }

    // ── Desactivar / reactivar ──────────────────────────────────────────────

    [Fact]
    public void DeactivateBranch_y_ReactivateBranch_son_reversibles_y_anotan_bitacora()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));
        tenant.MarkAsPersisted();

        tenant.DeactivateBranch(branchId, Actor, "  inventario  ").IsSuccess.Should().BeTrue();
        tenant.Branches.Single().IsActive.Should().BeFalse();
        tenant.ReactivateBranch(branchId, Actor).IsSuccess.Should().BeTrue();
        tenant.Branches.Single().IsActive.Should().BeTrue();

        tenant.Version.Should().Be(4);
        tenant.DomainEvents.GetUncommittedChanges().Select(e => e.GetType())
            .Should().Equal(typeof(BranchDeactivatedEvent), typeof(BranchReactivatedEvent));
        tenant.PendingBranchLifecycleEntries.Select(e => (e.Episode, e.Reason))
            .Should().Equal((BranchLifecycleEpisode.Deactivated, "inventario"), (BranchLifecycleEpisode.Reactivated, (string?)null));
    }

    [Fact]
    public void Transiciones_de_sede_desde_el_mismo_estado_son_invalidas()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));

        tenant.ReactivateBranch(branchId, Actor).Error.Should().Be(DomainErrors.Tenant.BranchAlreadyActive);
        tenant.DeactivateBranch(branchId, Actor);
        tenant.DeactivateBranch(branchId, Actor).Error.Should().Be(DomainErrors.Tenant.BranchAlreadyInactive);
    }

    [Fact]
    public void ReactivateBranch_exige_tenant_activo()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));
        tenant.DeactivateBranch(branchId, Actor);
        tenant.Suspend(Actor);

        tenant.ReactivateBranch(branchId, Actor).Error.Should().Be(DomainErrors.Tenant.NotActive);
        tenant.Branches.Single().IsActive.Should().BeFalse();
    }

    [Fact]
    public void CloseBranch_se_permite_con_tenant_suspendido_porque_reduce_actividad()
    {
        var tenant = TenantMother.Active();
        var lima = BranchId.Load(TenantMother.AddBranch(tenant, "LIMA"));
        var callao = BranchId.Load(TenantMother.AddBranch(tenant, "CALLAO"));
        tenant.DeactivateBranch(lima, Actor);
        tenant.DeactivateBranch(callao, Actor);
        tenant.Suspend(Actor);

        tenant.CloseBranch(callao, Actor).IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void Operaciones_de_sede_con_motivo_demasiado_largo_fallan()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));
        var motivo = new string('m', BranchLifecycleEntry.ReasonMaxLength + 1);

        tenant.DeactivateBranch(branchId, Actor, motivo).Error.Should().Be(DomainErrors.Validation.ReasonTooLong);
        tenant.CloseBranch(branchId, Actor, motivo).Error.Should().Be(DomainErrors.Validation.ReasonTooLong);
        tenant.Branches.Single().IsActive.Should().BeTrue();
    }

    [Fact]
    public void Operaciones_sobre_una_sede_inexistente_fallan()
    {
        var tenant = TenantMother.Active();
        var inexistente = BranchId.Create();

        tenant.DeactivateBranch(inexistente, Actor).Error.Should().Be(DomainErrors.Tenant.BranchNotFound);
        tenant.ReactivateBranch(inexistente, Actor).Error.Should().Be(DomainErrors.Tenant.BranchNotFound);
        tenant.CloseBranch(inexistente, Actor).Error.Should().Be(DomainErrors.Tenant.BranchNotFound);
        tenant.Version.Should().Be(1);
    }

    // ── Cierre ──────────────────────────────────────────────────────────────

    [Fact]
    public void CloseBranch_es_terminal_conserva_la_fila_y_anota_el_cierre()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant, "PISCO"));
        tenant.MarkAsPersisted();
        var antes = DateTimeOffset.UtcNow;

        var result = tenant.CloseBranch(branchId, ActorId.Create("cierre"), "fin de contrato");

        result.IsSuccess.Should().BeTrue();
        var branch = tenant.Branches.Single();
        branch.IsClosed.Should().BeTrue();
        branch.IsActive.Should().BeFalse();
        branch.ClosedBy!.GetValue().Should().Be("cierre");
        branch.ClosedAtUtc.Should().BeOnOrAfter(antes).And.BeOnOrBefore(DateTimeOffset.UtcNow);
        tenant.Version.Should().Be(3);
        tenant.DomainEvents.GetUncommittedChanges().Should().ContainSingle().Which.Should().BeOfType<BranchClosedEvent>()
            .Which.Code.Should().Be("PISCO");
        var asiento = tenant.PendingBranchLifecycleEntries.Should().ContainSingle().Subject;
        asiento.Episode.Should().Be(BranchLifecycleEpisode.Closed);
        asiento.Reason.Should().Be("fin de contrato");
        asiento.OccurredAtUtc.Should().Be(branch.ClosedAtUtc!.Value);
        asiento.NameSnapshot.Should().Be("Sede PISCO");
    }

    [Fact]
    public void Una_sede_cerrada_no_admite_ninguna_otra_transicion()
    {
        var tenant = TenantMother.Active();
        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));
        tenant.CloseBranch(branchId, Actor);
        var version = tenant.Version;

        tenant.CloseBranch(branchId, Actor).Error.Should().Be(DomainErrors.Tenant.BranchClosed);
        tenant.ReactivateBranch(branchId, Actor).Error.Should().Be(DomainErrors.Tenant.BranchClosed);
        tenant.DeactivateBranch(branchId, Actor).Error.Should().Be(DomainErrors.Tenant.BranchClosed);
        tenant.Branches.Single().IsClosed.Should().BeTrue();
        tenant.Version.Should().Be(version);
    }

    [Fact]
    public void Cada_mutacion_de_sede_sube_la_version_del_agregado_en_uno()
    {
        var tenant = TenantMother.Active();
        var versiones = new List<long> { tenant.Version };

        var branchId = BranchId.Load(TenantMother.AddBranch(tenant));
        versiones.Add(tenant.Version);
        tenant.UpdateBranch(branchId, Name.Create("Nueva"), Actor);
        versiones.Add(tenant.Version);
        tenant.DeactivateBranch(branchId, Actor);
        versiones.Add(tenant.Version);
        tenant.ReactivateBranch(branchId, Actor);
        versiones.Add(tenant.Version);
        tenant.CloseBranch(branchId, Actor);
        versiones.Add(tenant.Version);

        versiones.Should().Equal(1, 2, 3, 4, 5, 6);
        tenant.DomainEvents.GetUncommittedChanges().Cast<TenantDomainEvent>().Select(e => e.Version)
            .Should().Equal(new long[] { 2, 3, 4, 5, 6 }, "el evento de alta (versión 1) ya se marcó como persistido");
    }
}
