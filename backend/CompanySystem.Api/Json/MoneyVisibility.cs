using System.Reflection;
using System.Text.Json.Serialization.Metadata;
using CompanySystem.Api.Auth;

namespace CompanySystem.Api.Json;

/// <summary>
/// What a project's material cost — on-site values, what a movement was worth,
/// plan budgets, dashboard money. Managers only, like the Costs page.
/// On a record, write it as <c>[property: CostFigure]</c>.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class CostFigureAttribute : Attribute;

/// <summary>
/// What we pay suppliers — item prices, invoices, price history, to-buy estimates.
/// Managers and the Procurement Officer (buying is their job).
/// On a record, write it as <c>[property: BuyingPrice]</c>.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class BuyingPriceAttribute : Attribute;

/// <summary>
/// Leaves money out of every API answer for people who may not see it. Tagging a
/// field is all it takes, so a new endpoint can't forget to hide it. (Only what the
/// API sends is affected; what it receives and what it stores are not.)
/// </summary>
public static class MoneyVisibility
{
    // Reads the signed-in user of the request being answered.
    private static readonly HttpContextAccessor Request = new();

    // The same groups as everywhere else (Roles.cs).
    private static readonly string[] SeeCosts = Roles.Managers.Split(',');
    private static readonly string[] SeePrices = Roles.Procurement.Split(',');

    public static void HideMoney(JsonTypeInfo type)
    {
        foreach (var property in type.Properties)
        {
            var member = property.AttributeProvider as MemberInfo;
            var allowed =
                member?.GetCustomAttribute<CostFigureAttribute>() is not null ? SeeCosts :
                member?.GetCustomAttribute<BuyingPriceAttribute>() is not null ? SeePrices :
                null;
            if (allowed is null) continue;

            var before = property.ShouldSerialize;
            property.ShouldSerialize = (owner, value) =>
                allowed.Any(role => Request.HttpContext?.User.IsInRole(role) == true) &&
                (before?.Invoke(owner, value) ?? true);
        }
    }
}
