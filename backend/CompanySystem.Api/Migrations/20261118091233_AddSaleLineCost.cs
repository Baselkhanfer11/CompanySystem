using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CompanySystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleLineCost : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "UnitCost",
                table: "SaleItems",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            // Sales delivered before this column existed: the best cost we have
            // is the item's price today.
            migrationBuilder.Sql("""
                UPDATE li SET li.UnitCost = i.Price
                FROM [SaleItems] li
                JOIN [Sales] s ON s.Id = li.SaleId
                JOIN [Items] i ON i.Id = li.ItemId
                WHERE s.Status = 'Delivered';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UnitCost",
                table: "SaleItems");
        }
    }
}
