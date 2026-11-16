using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mdm.Infrastructure.Migrations.SqlServer.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "mdm");

            migrationBuilder.CreateTable(
                name: "Tenants",
                schema: "mdm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, collation: "Latin1_General_100_CI_AS"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Latin1_General_100_CI_AS"),
                    OrganizationTypeId = table.Column<int>(type: "int", nullable: false),
                    CompanyReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true, collation: "Latin1_General_100_CI_AS"),
                    ParentTenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StatusId = table.Column<int>(type: "int", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", nullable: false),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", nullable: true),
                    AuditTimeSpan = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                    table.CheckConstraint("CK_Tenants_OrganizationTypeId", "[OrganizationTypeId] IN (1, 2, 3)");
                    table.CheckConstraint("CK_Tenants_ParentNotSelf", "[ParentTenantId] IS NULL OR [ParentTenantId] <> [Id]");
                    table.CheckConstraint("CK_Tenants_StatusId", "[StatusId] IN (1, 2, 3)");
                    table.CheckConstraint("CK_Tenants_Version", "[Version] >= 1");
                    table.ForeignKey(
                        name: "FK_Tenants_ParentTenantId",
                        column: x => x.ParentTenantId,
                        principalSchema: "mdm",
                        principalTable: "Tenants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TenantBranches",
                schema: "mdm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, collation: "Latin1_General_100_CI_AS"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Latin1_General_100_CI_AS"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsClosed = table.Column<bool>(type: "bit", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", nullable: true),
                    ClosedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", nullable: false),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", nullable: true),
                    AuditTimeSpan = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantBranches", x => x.Id);
                    table.CheckConstraint("CK_TenantBranches_Closure", "([IsClosed] = 0 AND [ClosedAt] IS NULL AND [ClosedBy] IS NULL) OR ([IsClosed] = 1 AND [ClosedAt] IS NOT NULL AND [IsActive] = 0)");
                    table.ForeignKey(
                        name: "FK_TenantBranches_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "mdm",
                        principalTable: "Tenants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "BranchLifecycleEntries",
                schema: "mdm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", nullable: false),
                    ActorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchLifecycleEntries", x => x.Id);
                    table.CheckConstraint("CK_BranchLifecycleEntries_EpisodeId", "[EpisodeId] IN (1, 2, 3, 4)");
                    table.ForeignKey(
                        name: "FK_BranchLifecycleEntries_BranchId",
                        column: x => x.BranchId,
                        principalSchema: "mdm",
                        principalTable: "TenantBranches",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_BranchLifecycleEntries_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "mdm",
                        principalTable: "Tenants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_BranchLifecycleEntries_BranchId_OccurredAt",
                schema: "mdm",
                table: "BranchLifecycleEntries",
                columns: new[] { "BranchId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_BranchLifecycleEntries_TenantId",
                schema: "mdm",
                table: "BranchLifecycleEntries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "UX_TenantBranches_TenantId_Code",
                schema: "mdm",
                table: "TenantBranches",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_ParentTenantId",
                schema: "mdm",
                table: "Tenants",
                column: "ParentTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_StatusId_Code",
                schema: "mdm",
                table: "Tenants",
                columns: new[] { "StatusId", "Code" });

            migrationBuilder.CreateIndex(
                name: "UX_Tenants_Code",
                schema: "mdm",
                table: "Tenants",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Tenants_CompanyReference",
                schema: "mdm",
                table: "Tenants",
                column: "CompanyReference",
                unique: true,
                filter: "[CompanyReference] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BranchLifecycleEntries",
                schema: "mdm");

            migrationBuilder.DropTable(
                name: "TenantBranches",
                schema: "mdm");

            migrationBuilder.DropTable(
                name: "Tenants",
                schema: "mdm");
        }
    }
}
