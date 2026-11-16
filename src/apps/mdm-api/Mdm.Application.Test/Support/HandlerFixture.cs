namespace Mdm.Application.Test.Support;

using Moq;
using Mdm.Application.Common;
using Mdm.Application.Organization;
using Mdm.Application.Organization.Abstractions;
using Mdm.Domain.Kernel.ValueObjects;
using Mdm.Domain.Organization.Tenant;
using TenantAggregate = Mdm.Domain.Organization.Tenant.Tenant;

/// <summary>Puertos simulados y ejecutor real: lo que cada handler de escritura necesita.</summary>
public abstract class HandlerFixture
{
    protected HandlerFixture()
    {
        CurrentUser.SetupGet(u => u.ActorId).Returns(TenantMother.ActorName);
        Executor = new TenantMutationExecutor(Tenants.Object, UnitOfWork.Object, CurrentUser.Object);
    }

    protected Mock<ITenantRepository> Tenants { get; } = new();

    protected Mock<IUnitOfWork> UnitOfWork { get; } = new();

    protected Mock<ICurrentUser> CurrentUser { get; } = new();

    internal TenantMutationExecutor Executor { get; }

    protected void Returns(TenantAggregate? tenant) =>
        Tenants.Setup(r => r.GetByIdAsync(It.IsAny<TenantId>(), It.IsAny<CancellationToken>())).ReturnsAsync(tenant);

    protected void SaveThrows(Exception exception) =>
        UnitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(exception);

    protected void VerifyNothingPersisted()
    {
        Tenants.Verify(r => r.UpdateAsync(It.IsAny<TenantAggregate>(), It.IsAny<CancellationToken>()), Times.Never);
        Tenants.Verify(r => r.AddAsync(It.IsAny<TenantAggregate>(), It.IsAny<CancellationToken>()), Times.Never);
        UnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
