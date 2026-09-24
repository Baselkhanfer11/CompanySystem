using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CompanySystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStockMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Purchases_Projects_ProjectId",
                table: "Purchases");

            migrationBuilder.CreateTable(
                name: "StockMovements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockMovements_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockMovements_Users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StockMovementLines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StockMovementId = table.Column<int>(type: "int", nullable: false),
                    ItemId = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovementLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockMovementLines_Items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "Items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockMovementLines_StockMovements_StockMovementId",
                        column: x => x.StockMovementId,
                        principalTable: "StockMovements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovementLines_ItemId",
                table: "StockMovementLines",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovementLines_StockMovementId",
                table: "StockMovementLines",
                column: "StockMovementId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_CreatedById",
                table: "StockMovements",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_ProjectId",
                table: "StockMovements",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_Purchases_Projects_ProjectId",
                table: "Purchases",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Existing data: purchases charged to a project used to ALSO add to
            // the warehouse. Now that material counts as on the project's site,
            // so take it back out of the warehouse (never below zero).
            migrationBuilder.Sql(@"
UPDATE i SET Quantity = CASE WHEN i.Quantity - s.Qty < 0 THEN 0 ELSE i.Quantity - s.Qty END
FROM Items i
JOIN (SELECT li.ItemId, SUM(li.Quantity) AS Qty
      FROM PurchaseItems li JOIN Purchases p ON p.Id = li.PurchaseId
      WHERE p.ProjectId IS NOT NULL
      GROUP BY li.ItemId) s ON s.ItemId = i.Id;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Undo the data change: project purchases count in the warehouse again.
            migrationBuilder.Sql(@"
UPDATE i SET Quantity = i.Quantity + s.Qty
FROM Items i
JOIN (SELECT li.ItemId, SUM(li.Quantity) AS Qty
      FROM PurchaseItems li JOIN Purchases p ON p.Id = li.PurchaseId
      WHERE p.ProjectId IS NOT NULL
      GROUP BY li.ItemId) s ON s.ItemId = i.Id;");

            migrationBuilder.DropForeignKey(
                name: "FK_Purchases_Projects_ProjectId",
                table: "Purchases");

            migrationBuilder.DropTable(
                name: "StockMovementLines");

            migrationBuilder.DropTable(
                name: "StockMovements");

            migrationBuilder.AddForeignKey(
                name: "FK_Purchases_Projects_ProjectId",
                table: "Purchases",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
