using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CompanySystem.Api.Services;

/// <summary>
/// Thrown when the stock lock (see StockService.BeginChange) couldn't be taken in
/// time: another change held it for too long. Nothing is wrong with the data —
/// the change just needs to be tried again.
/// </summary>
public class StockBusyException() : Exception("The stock is busy with another change. Please try again.");

/// <summary>
/// Turns a StockBusyException into a 409 with a friendly message, instead of the
/// 500 an unhandled exception would give. Registered for every controller in Program.cs.
/// </summary>
public class StockBusyFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not StockBusyException busy) return;
        context.Result = new ConflictObjectResult(new { message = busy.Message });
        context.ExceptionHandled = true;
    }
}
