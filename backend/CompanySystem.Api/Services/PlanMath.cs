namespace CompanySystem.Api.Services;

// One planned item: how many are planned, how many are on the site, and its price.
public readonly record struct PlanPoint(int Planned, int OnSite, decimal Price);

/// <summary>
/// The material-plan numbers, in one place, so the plan window and the
/// dashboard can never disagree.
/// </summary>
public static class PlanMath
{
    // Budget = planned × price. Still to spend = what's not on site yet × price.
    // Progress = share of the planned material (by value) that's already on site.
    public static (decimal Budget, decimal StillToSpend, int Progress) Summarize(IEnumerable<PlanPoint> points)
    {
        decimal budget = 0, still = 0, covered = 0;
        foreach (var p in points)
        {
            budget += p.Planned * p.Price;
            still += Math.Max(0, p.Planned - p.OnSite) * p.Price;
            covered += Math.Min(p.OnSite, p.Planned) * p.Price;
        }
        var progress = budget > 0 ? (int)Math.Round(covered / budget * 100) : 0;
        return (budget, still, progress);
    }
}
