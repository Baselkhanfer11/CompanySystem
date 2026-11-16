using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CompanySystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMovementLineValue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Value",
                table: "StockMovementLines",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            // Existing lines: the value they have always counted for.
            migrationBuilder.Sql("UPDATE [StockMovementLines] SET [Value] = [Quantity] * [UnitCost];");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Value",
                table: "StockMovementLines");
        }
    }
}
